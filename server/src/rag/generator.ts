import type { AppContext } from '../app/context.js';
import type { ProviderError } from '../llm/retry.js';
import { truncate } from '../utils/text.js';
import { validateModelAnswer } from './answerValidation.js';
import { candidateText, type EvidenceAssessment } from './evidence.js';
import { TIER_LABEL, type TrustTier } from './sourceTrust.js';
import { ANSWER_SCHEMA, buildMessages, type PromptSource } from './prompts.js';
import type { QueryAnalysis } from './queryAnalysis.js';
import { textHasTerm, type Candidate } from './retrieval.js';

export type AnswerStatus =
  | 'answered'
  | 'partial'
  | 'clarification'
  | 'no_evidence'
  | 'out_of_scope'
  | 'refused'
  | 'limitation'
  | 'greeting'
  | 'technical_failure';

export interface SourceRef {
  id: string;
  type: 'listing' | 'faq' | 'document' | 'classified';
  title: string;
  url: string | null;
  /** Trusted Information Network tier (official, institutional, local, publication, background). */
  tier: TrustTier;
  /** When the source page says it was last updated (YYYY-MM-DD), if known. */
  updatedAt: string | null;
}

export interface GeneratedAnswer {
  text: string;
  status: AnswerStatus;
  sources: SourceRef[];
  needsClarification: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  generation: 'llm' | 'extractive' | 'template';
  validationProblems: string[];
  shownListings: Array<{ id: string; name: string }>;
  latencyMs?: number;
}

// ------------------------------------------------------------------ helpers
const line = (text: string, label: string) => text.match(new RegExp(`^${label}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';

export function toSourceRef(c: Candidate): SourceRef {
  const url =
    (c.sourceType === 'listing' || c.sourceType === 'classified') && typeof c.metadata.url === 'string'
      ? c.metadata.url
      : typeof c.metadata.sourceUrl === 'string' && /^https?:\/\//i.test(c.metadata.sourceUrl)
        ? c.metadata.sourceUrl
        : null;
  return { id: c.sourceId, type: c.sourceType, title: c.title, url, tier: c.tier, updatedAt: sourceDate(c) };
}

const sourceDate = (c: Candidate) => (typeof c.metadata.sourceUpdatedAt === 'string' ? c.metadata.sourceUpdatedAt.slice(0, 10) : null);

function listingSummary(c: Candidate) {
  const text = candidateText(c);
  const profile = c.chunks.find((x) => x.chunk_kind === 'listing_profile')?.chunk_text ?? '';
  const body = profile.split('\n').slice(1).join(' ').trim();
  return {
    name: c.title,
    area: (c.metadata.area as string) || line(text, 'Area'),
    description: body ? truncate(body.split(/(?<=[.!?])\s/)[0] ?? body, 160) : '',
    phone: line(text, 'Phone'),
    email: line(text, 'Email'),
    website: line(text, 'Website'),
    hours: line(text, 'Opening hours'),
    text,
  };
}

function formatListing(c: Candidate, attribute: QueryAnalysis['attribute']) {
  const s = listingSummary(c);
  const contact = [s.phone && `Phone: ${s.phone}`, s.email && `Email: ${s.email}`, s.website && `Website: ${s.website}`].filter(Boolean).join(' · ');
  const extra = attribute === 'opening_hours' && s.hours ? ` Opening hours: ${s.hours}.` : '';
  return `- ${s.name}${s.area ? ` (${s.area})` : ''}${s.description ? ` — ${s.description}` : ''}${extra}${contact ? ` ${contact}` : ''}`;
}

const plural = (name: string) => name.toLowerCase();

// ------------------------------------------------------------------ fixed responses (no retrieval)
export const TEMPLATES = {
  greeting:
    'Hi! Ask me anything about Barbados — history, culture, food, places, businesses, government services or everyday life. What would you like to know?',
  security_probe:
    'I can’t share internal instructions, keys or private data. I’m happy to help you search the AI Bajan directory — for example places to eat, stay or visit in Barbados.',
  fabrication_request:
    'I can only share businesses that are actually listed in the AI Bajan directory, so I won’t make up businesses, phone numbers or other details. Tell me what kind of place you’re after and I’ll show you real listings.',
  out_of_scope:
    'That’s outside what I can help with — AI Bajan answers questions about Barbados: our history, culture, food, people, places, businesses, government services and everyday life.',
  technical_failure:
    'Sorry — I couldn’t search the directory just now because of a technical problem on our side. This isn’t a missing answer; please try again in a moment.',
  live: {
    weather: 'I don’t have live weather data, so I can’t tell you the current conditions. A local forecast service will have up-to-date information.',
    booking_action: 'I can’t make bookings or reservations myself.',
    live_price: 'I don’t have live prices. The directory only shows the price ranges businesses have provided.',
    live_availability: 'I can’t check live availability or stock.',
    news: 'I don’t have access to live news.',
  },
} as const;

export function templateAnswer(status: AnswerStatus, text: string): GeneratedAnswer {
  return { text, status, sources: [], needsClarification: false, fallbackUsed: false, fallbackReason: null, generation: 'template', validationProblems: [], shownListings: [] };
}

// ------------------------------------------------------------------ sentence selection
/** Remove reference markers and page furniture that web/encyclopedia pages leave in text. */
export function stripDebris(s: string): string {
  return s
    .replace(/\[\s*(?:\d+|[a-z]|edit|citation needed|note \d+|nb \d+)\s*\]/gi, '')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Chunk text as clean lines: no "Title › Heading" prefix, list markers, tables or debris. */
function cleanLines(text: string, type: string): string[] {
  const lines = text.split('\n');
  return (type === 'faq' ? lines : lines.slice(1))
    .map((l) => stripDebris(l.replace(/^#+\s*/, '').replace(/^-\s+/, '')))
    .filter((l) => l && !l.includes(' | ') && !/ › /.test(l));
}

function cleanChunk(text: string, type: string) {
  return cleanLines(text, type).join(' ');
}

const STOP_SENT =
  /^(see also|references|external links|this article|for other uses)|coordinates\s*:|from wikipedia|imported from|the free encyclopedia|^(retrieved|archived)\b|isbn|doi:/i;
const DEFINITION_Q = /^(what|who|where)\s+(is|are|was|were)\b/;
const LOCAL = /\b(barbad\w*|bajan\w*|bridgetown)\b/i;

/**
 * Pick the sentences that best answer the question, quoted verbatim from the sources (nothing is
 * paraphrased or invented). Scoring: share of question terms present, exact phrase match,
 * Barbados relevance for Barbados questions, and — for "what/who is X" — the opening sentences
 * of the article whose title is X.
 */
export function bestSentences(a: QueryAnalysis, candidates: Candidate[]): { sentences: string[]; sources: Candidate[] } {
  const terms = [...new Set([...a.keyTerms.filter((t) => t.length > 2), ...a.phrases])];
  if (!terms.length) return { sentences: [], sources: [] };
  const wantsLocal = LOCAL.test(a.normalized);
  const definition = DEFINITION_Q.test(a.normalized);
  const scored: Array<{ s: string; score: number; c: Candidate; order: number }> = [];
  candidates.forEach((c, ci) => {
    const titleTerms = c.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const titleMatch = titleTerms.length > 0 && titleTerms.every((w) => terms.some((t) => t.includes(w) || w.includes(t)));
    const lines = cleanLines(candidateText(c), c.sourceType);
    let index = 0;
    for (const line of lines) {
      for (const raw of line.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)) {
        const s = raw.trim();
        const i = index++;
        if (s.length < 40 || s.length > 420 || STOP_SENT.test(s) || !/[a-z]/.test(s) || !/[.!?]$/.test(s)) continue;
        const hits = terms.filter((t) => textHasTerm(s, t)).length;
        if (!hits) continue;
        let score = hits / terms.length;
        if (a.phrases.some((p) => textHasTerm(s, p))) score += 0.5;
        if (wantsLocal && LOCAL.test(s)) score += 0.6;
        if (definition && titleMatch && i < 3) score += 0.9 - i * 0.2;
        if (/\b(is|are|was|were)\b/.test(s) && definition) score += 0.1;
        score -= ci * 0.06 + Math.min(i, 30) * 0.004;
        scored.push({ s, score, c, order: ci * 1000 + i });
      }
    }
  });
  if (!scored.length) return { sentences: [], sources: [] };
  const ranked = scored.sort((x, y) => y.score - x.score);
  const best = ranked[0].score;
  const chosen = ranked
    .filter((x, i, arr) => arr.findIndex((y) => y.s === x.s) === i)
    .filter((x) => x.score >= best * 0.7)
    .slice(0, 3)
    .sort((x, y) => x.order - y.order);
  const sources = [...new Map(chosen.map((x) => [x.c.key, x.c])).values()];
  return { sentences: chosen.map((x) => x.s), sources };
}

// ------------------------------------------------------------------ extractive (deterministic) answers
export function extractiveAnswer(a: QueryAnalysis, ev: EvidenceAssessment): GeneratedAnswer {
  const parts: string[] = [];
  let used: Candidate[] = [];
  const product = a.productTerms.join(', ');
  const catName = a.categories[0]?.name;
  const where = a.locations[0] ? ` in ${a.locations[0].name}` : '';

  if (a.intent === 'listing_detail' && ev.listings.length) {
    const c = ev.listings[0];
    const s = listingSummary(c);
    const want: Record<string, string> = {
      opening_hours: s.hours && `${s.name} opening hours: ${s.hours}.`,
      contact: [s.phone && `Phone: ${s.phone}`, s.email && `Email: ${s.email}`, s.website && `Website: ${s.website}`].filter(Boolean).join(' · '),
      price: line(s.text, 'Price range') && `${s.name} price range: ${line(s.text, 'Price range')}.`,
      amenities: line(s.text, 'Amenities') && `${s.name} amenities: ${line(s.text, 'Amenities')}.`,
      address: line(s.text, 'Address') || s.area ? `${s.name} is in ${line(s.text, 'Address') || s.area}.` : '',
      booking: [line(s.text, 'Booking'), line(s.text, 'Booking link')].filter(Boolean).join(' '),
      accessibility: line(s.text, 'Accessibility'),
    };
    const answer = a.attribute ? want[a.attribute] : '';
    if (answer) parts.push(answer);
    else {
      if (a.attribute) parts.push(`The directory listing for ${s.name} doesn’t include ${a.attribute.replace('_', ' ')} information.`);
      parts.push(formatListing(c, null).replace(/^- /, ''));
    }
    used = [c];
  } else if (ev.listings.length) {
    const shown = ev.listings.slice(0, 8);
    used = shown;
    if (a.intent === 'business_prospecting') {
      parts.push(`Here are ${catName ? plural(catName) : 'businesses'} listed in the AI Bajan directory${where} that you could contact${product ? ` about ${product}` : ''}:`);
    } else if (a.intent === 'product_availability') {
      const matching = shown.filter((c) => c.productMatch);
      const others = shown.filter((c) => !c.productMatch);
      if (matching.length) {
        parts.push(`${matching.length === 1 ? 'This listing mentions' : 'These listings mention'} ${product}${where}:`);
        for (const c of matching) parts.push(formatListing(c, a.attribute));
        if (others.length) {
          parts.push(`Other ${catName ? plural(catName) : 'businesses'} listed${where} (the directory doesn’t say whether they stock ${product}):`);
          for (const c of others) parts.push(formatListing(c, a.attribute));
        }
      } else {
        parts.push(`I couldn’t find a listing that mentions ${product}, but these ${catName ? plural(catName) : 'businesses'}${where} are listed:`);
        for (const c of others) parts.push(formatListing(c, a.attribute));
      }
    } else if (ev.caveats.includes('refinement_not_matched')) {
      parts.push(`None of the ${catName ? plural(catName) : 'listings'}${where} mention ${product} in their directory details. Here is what is listed:`);
    } else if (a.productTerms.length) {
      parts.push(`${catName ?? 'Listings'}${where} that mention ${product}:`);
    } else {
      parts.push(`Here ${shown.length === 1 ? 'is the' : 'are the'} ${catName ? plural(catName) : 'listings'} listed in the AI Bajan directory${where}:`);
    }
    if (a.intent !== 'product_availability') for (const c of shown) parts.push(formatListing(c, a.attribute));
    if (ev.listings.length > shown.length) parts.push(`…and ${ev.listings.length - shown.length} more in the directory.`);
    if (ev.caveats.includes('purchase_interest_not_verified')) {
      parts.push(
        `The directory lists these businesses but doesn’t say whether they buy ${product || 'this product'} or are looking for new suppliers. You’d need to contact them directly to ask about purchasing.`,
      );
    } else if (ev.caveats.includes('product_not_verified') && a.intent !== 'product_availability') {
      parts.push(`The listings don’t confirm whether they stock ${product}, so it’s worth calling ahead.`);
    }
    if (a.attribute === 'contact') parts.push('Contact details are shown as provided to the directory; AI Bajan has not independently verified them.');
  } else if (ev.selected.length) {
    const picked = bestSentences(a, ev.selected.slice(0, 4));
    if (picked.sentences.length) {
      used = picked.sources;
      parts.push(picked.sentences.join(' '));
    } else {
      used = ev.selected.slice(0, 2);
      for (const c of used) parts.push(`- ${c.title}: ${truncate(cleanChunk(candidateText(c), c.sourceType), 320)}`);
    }
    if (ev.level === 'partial') parts.push('The sources only partly cover this question.');
  }
  if (ev.caveats.includes('location_unresolved')) parts.push('Tell me which area you’re in and I’ll narrow these down.');

  return {
    text: parts.join('\n'),
    status: ev.level === 'strong' ? 'answered' : 'partial',
    sources: used.map(toSourceRef),
    needsClarification: false,
    fallbackUsed: false,
    fallbackReason: null,
    generation: 'extractive',
    validationProblems: [],
    shownListings: used.filter((c) => c.sourceType === 'listing').map((c) => ({ id: c.sourceId, name: c.title })),
  };
}

/** Honest "not found" messages, specific to what was asked. */
export function noEvidenceAnswer(a: QueryAnalysis): GeneratedAnswer {
  const where = a.locations[0] ? ` in ${a.locations[0].name}` : '';
  const product = a.productTerms.join(', ');
  let text: string;
  if (a.intent === 'listing_detail') text = 'I couldn’t find a business by that name in the AI Bajan directory. Could you check the name, or tell me what kind of place it is?';
  else if (a.intent === 'business_prospecting')
    text = `The AI Bajan directory doesn’t have information about who buys ${product || 'that product'}. It lists businesses and their public contact details, but not their purchasing needs. If you tell me what type of business you’d like to approach, I can list the ones in the directory with their contact details.`;
  else if (a.intent === 'product_availability')
    text = `I couldn’t find any listing that mentions ${product || 'that'}${where}. If you tell me what type of shop you’re looking for, I can list those in the directory.`;
  else if (a.categories.length) text = `I couldn’t find any ${plural(a.categories[0].name)} listed in the AI Bajan directory${where} yet.`;
  else
    text =
      'I don’t have a reliable Barbadian source that answers that yet, so I won’t guess. Try rephrasing, or ask about Barbados’s history, culture, food, places, businesses or government services.';
  return { ...templateAnswer('no_evidence', text), fallbackUsed: true, fallbackReason: 'no_relevant_evidence' };
}

// ------------------------------------------------------------------ LLM path
export function buildPromptSources(selected: Candidate[], maxChars: number): PromptSource[] {
  const out: PromptSource[] = [];
  let budget = maxChars;
  for (const [i, c] of selected.entries()) {
    if (budget <= 200) break;
    const text = truncate(candidateText(c), Math.min(1800, budget));
    budget -= text.length;
    out.push({ id: `S${i + 1}`, type: c.sourceType, title: c.title, text, authority: TIER_LABEL[c.tier], updated: sourceDate(c) });
  }
  return out;
}

export async function generateAnswer(
  ctx: AppContext,
  args: {
    analysis: QueryAnalysis;
    evidence: EvidenceAssessment;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    memorySummary: string;
    language: string;
    audience?: 'resident' | 'visitor';
  },
): Promise<GeneratedAnswer> {
  const { analysis, evidence } = args;
  const extractive = () => extractiveAnswer(analysis, evidence);
  if (!ctx.llm.available) return { ...extractive(), fallbackReason: 'llm_not_configured' };

  const selected = evidence.selected.slice(0, ctx.config.RETRIEVAL_CONTEXT_LIMIT);
  const sources = buildPromptSources(selected, ctx.config.RETRIEVAL_MAX_CONTEXT_CHARS);
  const started = performance.now();
  try {
    const raw = await ctx.llm.completeJson({
      messages: buildMessages({ ...args, sources }),
      schemaName: 'ai_bajan_answer',
      schema: ANSWER_SCHEMA as unknown as Record<string, unknown>,
    });
    const v = validateModelAnswer(raw, sources);
    const latencyMs = Math.round(performance.now() - started);
    if (!v.ok || !v.answer) {
      return { ...extractive(), fallbackUsed: true, fallbackReason: 'answer_failed_validation', validationProblems: v.problems, latencyMs };
    }
    const byId = new Map(sources.map((s, i) => [s.id, selected[i]]));
    const cited = v.answer.source_ids.map((id) => byId.get(id)).filter((c): c is Candidate => Boolean(c));
    if (v.answer.needs_clarification && v.answer.clarification_question) {
      return {
        text: v.answer.clarification_question,
        status: 'clarification',
        sources: [],
        needsClarification: true,
        fallbackUsed: false,
        fallbackReason: null,
        generation: 'llm',
        validationProblems: v.problems,
        shownListings: [],
        latencyMs,
      };
    }
    const listingsShown = (cited.length ? cited : evidence.listings).filter((c) => c.sourceType === 'listing');
    return {
      text: v.answer.answer,
      status: evidence.level === 'strong' ? 'answered' : 'partial',
      sources: cited.map(toSourceRef),
      needsClarification: false,
      fallbackUsed: false,
      fallbackReason: null,
      generation: 'llm',
      validationProblems: v.problems,
      shownListings: listingsShown.map((c) => ({ id: c.sourceId, name: c.title })),
      latencyMs,
    };
  } catch (err) {
    // The model is unavailable, but retrieval worked: answer deterministically from the evidence
    // instead of hiding the outage behind "I don't know".
    const kind = (err as ProviderError).kind ?? 'unknown';
    return { ...extractive(), fallbackUsed: true, fallbackReason: `llm_error:${kind}`, latencyMs: Math.round(performance.now() - started) };
  }
}
