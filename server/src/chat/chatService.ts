import type { AppContext } from '../app/context.js';
import { visitorKey } from '../auth/visitorToken.js';
import { conflict, notFound } from '../utils/errors.js';
import { logger, scrub } from '../utils/logger.js';
import { assessEvidence, type EvidenceAssessment } from '../rag/evidence.js';
import { PRICE_REFERRAL_TEXT, priceReferral } from '../rag/priceReferral.js';
import { generateAnswer, noEvidenceAnswer, templateAnswer, TEMPLATES, type GeneratedAnswer } from '../rag/generator.js';
import { nextMemoryState, resolveWithMemory, summarizeMemory, type MemoryState } from '../rag/memory.js';
import { analyzeQuery, type QueryAnalysis } from '../rag/queryAnalysis.js';
import { retrieve, RETRIEVAL_CONFIG_VERSION, type RetrievalResult } from '../rag/retrieval.js';

export interface ChatRequest {
  message: string;
  conversationId?: string;
  language: string;
  clientMessageId?: string;
  context?: { listingId?: string };
  audience?: 'resident' | 'visitor';
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  sources: GeneratedAnswer['sources'];
  needsClarification: boolean;
  fallbackUsed: boolean;
  status: GeneratedAnswer['status'];
  meta: {
    intent: string;
    evidence: string;
    generation: GeneratedAnswer['generation'];
    usedConversationContext: boolean;
  };
}

interface ConversationRow {
  id: string;
  visitor_key: string;
  memory_state: MemoryState;
  message_count: number;
  status: string;
}

/** Redact obvious personal data before a query is stored in diagnostics. */
export function redactForLog(text: string): string {
  return scrub(text)
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\+?\d[\d ().-]{7,}\d/g, '[number]')
    .slice(0, 500);
}

const OUTCOME: Record<GeneratedAnswer['status'], 'answered' | 'partial' | 'fallback' | 'error'> = {
  answered: 'answered',
  partial: 'partial',
  clarification: 'partial',
  greeting: 'answered',
  limitation: 'fallback',
  no_evidence: 'fallback',
  out_of_scope: 'fallback',
  refused: 'fallback',
  technical_failure: 'error',
};

async function loadConversation(ctx: AppContext, id: string, owner: string): Promise<ConversationRow> {
  // Ownership is part of the WHERE clause: someone else's conversation is indistinguishable from
  // a non-existent one (404, no information leak).
  const row = await ctx.db.one<ConversationRow>(
    `select id, visitor_key, memory_state, message_count, status from ${ctx.db.t('conversations')} where id = $1 and visitor_key = $2`,
    [id, owner],
  );
  if (!row) throw notFound('Conversation');
  return row;
}

export async function handleChat(ctx: AppContext, req: ChatRequest, visitorId: string, requestId: string): Promise<ChatResponse> {
  const { db } = ctx;
  const owner = visitorKey(visitorId);
  const started = performance.now();
  const timings: Record<string, number> = {};

  // ---------------------------------------------------------------- conversation
  let conversation: ConversationRow;
  if (req.conversationId) conversation = await loadConversation(ctx, req.conversationId, owner);
  else {
    conversation = (await db.one<ConversationRow>(
      `insert into ${db.t('conversations')} (visitor_key, language) values ($1, $2)
       returning id, visitor_key, memory_state, message_count, status`,
      [owner, req.language],
    ))!;
  }

  // Duplicate submission (client retry): return the answer already produced for it.
  if (req.clientMessageId) {
    const prior = await db.one<{ id: string; content: string; sources: GeneratedAnswer['sources']; answer_meta: Record<string, unknown> }>(
      `select a.id, a.content, a.sources, a.answer_meta from ${db.t('messages')} u
         join ${db.t('messages')} a on a.conversation_id = u.conversation_id and a.role = 'assistant'
              and a.answer_meta->>'replyTo' = u.id::text
        where u.conversation_id = $1 and u.client_message_id = $2`,
      [conversation.id, req.clientMessageId],
    );
    if (prior) {
      const m = prior.answer_meta as Record<string, never>;
      return {
        conversationId: conversation.id,
        messageId: prior.id,
        answer: prior.content,
        sources: prior.sources,
        needsClarification: Boolean(m.needsClarification),
        fallbackUsed: Boolean(m.fallbackUsed),
        status: m.status,
        meta: { intent: m.intent, evidence: m.evidence, generation: m.generation, usedConversationContext: Boolean(m.usedConversationContext) },
      };
    }
  }

  const userMsg = await db.one<{ id: string }>(
    `insert into ${db.t('messages')} (conversation_id, role, content, client_message_id) values ($1, 'user', $2, $3)
     on conflict (conversation_id, client_message_id) where client_message_id is not null do nothing returning id`,
    [conversation.id, req.message, req.clientMessageId ?? null],
  );
  if (!userMsg) {
    // Concurrent duplicate still being processed.
    throw conflict('This message is already being processed.');
  }

  // ---------------------------------------------------------------- understand
  const lexicon = await ctx.lexicon.get();
  const raw = analyzeQuery(req.message, lexicon);
  const memoryState: MemoryState = conversation.memory_state ?? {};
  // Page context (the listing the visitor is viewing) is only honoured for eligible listings and
  // only resolves "this place"-style references; it is never treated as knowledge.
  const contextListing = req.context?.listingId ? lexicon.listingNames.find((l) => l.id === req.context!.listingId) : undefined;
  const effectiveState: MemoryState =
    contextListing && raw.singularReference && !raw.listings.length ? { ...memoryState, listings: [{ id: contextListing.id, name: contextListing.name }] } : memoryState;
  const resolution = resolveWithMemory(raw, effectiveState);
  const analysis: QueryAnalysis = resolution.analysis;

  // ---------------------------------------------------------------- answer
  let answer: GeneratedAnswer;
  let evidence: EvidenceAssessment | null = null;
  let retrieval: RetrievalResult | null = null;

  const history = await db.many<{ role: 'user' | 'assistant'; content: string }>(
    `select role, content from (
       select role, content, created_at from ${db.t('messages')} where conversation_id = $1 and id <> $2
        order by created_at desc limit $3) h order by created_at`,
    [conversation.id, userMsg.id, ctx.config.MEMORY_TURNS * 2],
  );

  switch (analysis.intent) {
    case 'greeting':
      answer = templateAnswer('greeting', TEMPLATES.greeting);
      break;
    case 'security_probe':
      answer = templateAnswer('refused', TEMPLATES.security_probe);
      break;
    case 'fabrication_request':
      answer = templateAnswer('refused', TEMPLATES.fabrication_request);
      break;
    case 'out_of_scope':
      answer = templateAnswer('out_of_scope', TEMPLATES.out_of_scope);
      break;
    default: {
      const t0 = performance.now();
      retrieval = await retrieve(ctx, analysis);
      timings.retrieval = Math.round(performance.now() - t0);
      evidence = assessEvidence(analysis, retrieval, resolution, ctx.config.RETRIEVAL_CONTEXT_LIMIT, {
        strongCoverage: 0.6,
        partialCoverage: 0.34,
        strongSimilarity: 0.5,
        minSimilarity: ctx.config.RETRIEVAL_MIN_SIMILARITY,
      });
      if (evidence.level === 'failure') {
        answer = { ...templateAnswer('technical_failure', TEMPLATES.technical_failure), fallbackUsed: true, fallbackReason: 'retrieval_failure' };
      } else if (evidence.level === 'ambiguous') {
        answer = { ...templateAnswer('clarification', evidence.clarification ?? 'Could you tell me a bit more about what you’re looking for?'), needsClarification: true };
      } else if (evidence.level === 'none') {
        answer = noEvidenceAnswer(analysis);
      } else {
        const g0 = performance.now();
        answer = await generateAnswer(ctx, { analysis, evidence, history, memorySummary: summarizeMemory(memoryState), language: req.language, audience: req.audience });
        timings.generation = Math.round(performance.now() - g0);
      }
      // Supermarket price questions: point to AskDealia, the government's price-comparison service.
      const referral = priceReferral(analysis);
      if (referral && answer.status !== 'clarification' && answer.status !== 'technical_failure') {
        answer = {
          ...answer,
          text: answer.text.includes('AskDealia') ? answer.text : `${answer.text}\n\n${PRICE_REFERRAL_TEXT}`,
          sources: [...answer.sources.filter((s) => s.id !== referral.id), referral],
        };
      }
      if (analysis.intent === 'live_info' && analysis.liveKind) {
        const lead = TEMPLATES.live[analysis.liveKind];
        answer =
          answer.status === 'answered' || answer.status === 'partial'
            ? { ...answer, text: `${lead}\n\n${answer.text}`, status: 'limitation' }
            : { ...templateAnswer('limitation', `${lead} I can help you find businesses in the AI Bajan directory and their contact details so you can check directly.`) };
      }
    }
  }

  // ---------------------------------------------------------------- persist
  const memory = nextMemoryState(memoryState, analysis, answer.shownListings, answer.needsClarification ? answer.text : null);
  const usedContext = resolution.used.length > 0;
  const meta = {
    replyTo: userMsg.id,
    status: answer.status,
    intent: analysis.intent,
    evidence: evidence?.level ?? 'n/a',
    generation: answer.generation,
    needsClarification: answer.needsClarification,
    fallbackUsed: answer.fallbackUsed,
    fallbackReason: answer.fallbackReason,
    usedConversationContext: usedContext,
    validationProblems: answer.validationProblems.length ? answer.validationProblems.slice(0, 10) : undefined,
  };
  const p0 = performance.now();
  const assistant = await db.tx(async (client) => {
    const m = await client.query<{ id: string }>(
      `insert into ${db.t('messages')} (conversation_id, role, content, sources, answer_meta, error_code)
       values ($1, 'assistant', $2, $3, $4, $5) returning id`,
      [conversation.id, answer.text, JSON.stringify(answer.sources), JSON.stringify(meta), answer.status === 'technical_failure' ? 'RETRIEVAL_FAILURE' : null],
    );
    await client.query(
      `update ${db.t('conversations')} set message_count = message_count + 2, last_activity_at = now(), memory_state = $2,
              summary = $3, outcome = $4, language = $5
        where id = $1`,
      [conversation.id, JSON.stringify(memory), summarizeMemory(memory), OUTCOME[answer.status], req.language],
    );
    return m.rows[0];
  });
  timings.persistence = Math.round(performance.now() - p0);
  timings.total = Math.round(performance.now() - started);

  // Diagnostics are best-effort: a logging failure must not fail the user's request.
  await db.query(
    `insert into ${db.t('retrieval_logs')}
       (request_id, conversation_id, message_id, normalized_query, intent, filters, methods, candidate_count, selected_sources,
        scores, evidence_level, outcome, fallback_reason, latency_ms, embedding_model, chat_model, config_version)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      requestId,
      conversation.id,
      assistant.id,
      // Redact the original text (normalisation would split emails/numbers apart first).
      redactForLog(analysis.original).toLowerCase(),
      analysis.intent,
      JSON.stringify({
        categories: analysis.categories.map((c) => c.slug),
        locations: analysis.locations.map((l) => l.slug),
        listings: analysis.listings.map((l) => l.id),
        productTerms: analysis.productTerms,
        attribute: analysis.attribute,
        audience: req.audience ?? null,
        memoryUsed: resolution.used,
        memoryCleared: resolution.cleared,
        tsquery: retrieval?.tsquery ?? null,
        refinement: retrieval?.refinementUsed ?? false,
        errors: retrieval?.errors ?? [],
      }),
      retrieval?.methods ?? [],
      retrieval?.candidates.length ?? 0,
      JSON.stringify((evidence?.selected ?? []).map((c) => ({ type: c.sourceType, id: c.sourceId, score: Number(c.score.toFixed(5)) }))),
      JSON.stringify(
        Object.fromEntries(
          (retrieval?.candidates ?? []).slice(0, 10).map((c) => [
            c.key,
            { score: Number(c.score.toFixed(5)), coverage: Number(c.coverage.toFixed(2)), sim: c.signals.vectorSimilarity, kw: c.signals.keywordRank, structured: c.signals.structured },
          ]),
        ),
      ),
      evidence?.level ?? 'n/a',
      answer.status,
      answer.fallbackReason ?? '',
      JSON.stringify({ ...retrieval?.timings, ...timings, llm: answer.latencyMs ?? null }),
      ctx.llm.available ? ctx.llm.embeddingModel : '',
      answer.generation === 'llm' ? ctx.llm.chatModel : '',
      RETRIEVAL_CONFIG_VERSION,
    ],
  ).catch((err) => logger.warn({ err }, 'retrieval log write failed'));

  logger.info(
    { requestId, conversationId: conversation.id, intent: analysis.intent, evidence: evidence?.level, status: answer.status, generation: answer.generation, fallback: answer.fallbackReason, candidates: retrieval?.candidates.length ?? 0, timings },
    'chat answered',
  );

  return {
    conversationId: conversation.id,
    messageId: assistant.id,
    answer: answer.text,
    sources: answer.sources,
    needsClarification: answer.needsClarification,
    fallbackUsed: answer.fallbackUsed,
    status: answer.status,
    meta: { intent: analysis.intent, evidence: evidence?.level ?? 'n/a', generation: answer.generation, usedConversationContext: usedContext },
  };
}

/** Visitor's own conversation transcript (ownership enforced). */
export async function getVisitorConversation(ctx: AppContext, id: string, visitorId: string) {
  const conv = await loadConversation(ctx, id, visitorKey(visitorId));
  const messages = await ctx.db.many(
    `select id, role, content, sources, created_at as "createdAt" from ${ctx.db.t('messages')}
      where conversation_id = $1 order by created_at limit 500`,
    [conv.id],
  );
  return { id: conv.id, messages };
}
