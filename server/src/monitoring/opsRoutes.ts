import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import { requirePermission } from '../middleware/auth.js';
import { body, csv, paged, paginationQuery, params, query, uuidParam, validate } from '../middleware/core.js';
import { enqueueSync } from '../sync/syncQueue.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';

// ------------------------------------------------------------------ dashboard / analytics
export function analyticsRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  r.get('/dashboard', requirePermission('analytics:read'), validate({ query: z.strictObject({ days: z.coerce.number().int().min(1).max(365).default(30) }) }), async (req, res) => {
    const { days } = query<{ days: number }>(req);
    const [listings, knowledge, chat, daily, feedback, sync, topSources] = await Promise.all([
      db.many(`select status, count(*)::int as n from ${db.t('listings')} group by status`),
      db.one(
        `select (select count(*)::int from ${db.t('knowledge_documents')}) as documents,
                (select count(*)::int from ${db.t('faqs')}) as faqs,
                (select count(*)::int from ${db.t('knowledge_chunks')} where is_active) as "activeChunks",
                (select count(*)::int from ${db.t('index_state')} where status = 'failed') as "failedSources"`,
      ),
      db.one(
        `select count(*)::int as conversations,
                coalesce(sum(message_count), 0)::int as messages,
                count(*) filter (where outcome = 'fallback')::int as fallback,
                count(*) filter (where outcome = 'error')::int as errors
           from ${db.t('conversations')} where started_at >= now() - make_interval(days => $1)`,
        [days],
      ),
      db.many(
        `select to_char(d, 'YYYY-MM-DD') as date,
                (select count(*)::int from ${db.t('conversations')} c where c.started_at >= d and c.started_at < d + interval '1 day') as conversations,
                (select count(*)::int from ${db.t('retrieval_logs')} l where l.created_at >= d and l.created_at < d + interval '1 day' and l.outcome in ('no_evidence','technical_failure')) as unanswered
           from generate_series(current_date - ($1::int - 1), current_date, interval '1 day') d order by d`,
        [days],
      ),
      db.many(`select status, count(*)::int as n from ${db.t('feedback')} group by status`),
      db.many(`select status, count(*)::int as n from ${db.t('sync_jobs')} where created_at >= now() - interval '7 days' group by status`),
      db.many(
        `select s->>'type' as type, s->>'id' as id, count(*)::int as uses
           from ${db.t('retrieval_logs')}, jsonb_array_elements(selected_sources) s
          where created_at >= now() - make_interval(days => $1) group by 1, 2 order by uses desc limit 10`,
        [days],
      ),
    ]);
    res.json({
      days,
      listings: Object.fromEntries(listings.map((x) => [x.status, x.n])),
      knowledge,
      chatbot: chat,
      daily,
      feedback: Object.fromEntries(feedback.map((x) => [x.status, x.n])),
      syncJobsLast7Days: Object.fromEntries(sync.map((x) => [x.status, x.n])),
      topSources,
    });
  });
  /**
   * What people actually ask (anonymised), and which questions get poor or no answers.
   * "Poor" = no evidence, technical failure, clarification/partial, a fallback, or a "not helpful" rating.
   */
  r.get('/questions', requirePermission('analytics:read'), validate({ query: z.strictObject({ days: z.coerce.number().int().min(1).max(730).default(90), limit: z.coerce.number().int().min(5).max(200).default(50) }) }), async (req, res) => {
    const { days, limit } = query<{ days: number; limit: number }>(req);
    const key = `btrim(regexp_replace(lower(l.normalized_query), '[^a-z0-9 ]+', ' ', 'g'))`;
    const base = `from ${db.t('retrieval_logs')} l
      left join ${db.t('feedback')} f on f.message_id = l.message_id and f.helpful = false
      where l.created_at >= now() - make_interval(days => $1) and l.normalized_query <> ''`;
    const poor = `(l.outcome in ('no_evidence','technical_failure','partial','clarification') or l.fallback_reason <> '' or f.id is not null)`;
    const [totals, top, weak, intents] = await Promise.all([
      db.one(`select count(*)::int as questions, count(distinct ${key})::int as "uniqueQuestions",
                count(*) filter (where ${poor})::int as "poorlyAnswered",
                count(*) filter (where l.outcome = 'no_evidence')::int as "noAnswer" ${base}`, [days]),
      db.many(`select ${key} as question, count(*)::int as asked, max(l.created_at) as "lastAsked",
                count(*) filter (where ${poor})::int as "poorAnswers", mode() within group (order by l.intent) as intent
               ${base} group by 1 order by asked desc, "lastAsked" desc limit $2`, [days, limit]),
      db.many(`select ${key} as question, count(*)::int as asked, max(l.created_at) as "lastAsked",
                array_agg(distinct coalesce(nullif(l.outcome, ''), 'unknown')) as outcomes,
                array_agg(distinct nullif(l.fallback_reason, '')) filter (where l.fallback_reason <> '') as reasons,
                count(f.id)::int as "notHelpful"
               ${base} and ${poor} group by 1 order by asked desc, "lastAsked" desc limit $2`, [days, limit]),
      db.many(`select coalesce(nullif(l.intent, ''), 'unknown') as intent, count(*)::int as n ${base} group by 1 order by n desc`, [days]),
    ]);
    res.json({ days, totals, top, poor: weak, intents });
  });

  return r;
}

// ------------------------------------------------------------------ activity (audit) log
export function auditRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  r.get(
    '/',
    requirePermission('logs:read'),
    validate({ query: z.strictObject({ ...paginationQuery, entityType: z.string().max(40).regex(/^[a-z_]+$/).optional(), actorId: z.uuid().optional(), from: z.iso.date().optional(), to: z.iso.date().optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; entityType?: string; actorId?: string; from?: string; to?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      const add = (sql: string, v: unknown) => {
        p.push(v);
        where.push(sql.replace('?', `$${p.length}`));
      };
      if (f.entityType) add('entity_type = ?', f.entityType);
      if (f.actorId) add('actor_admin_id = ?', f.actorId);
      if (f.from) add('created_at >= ?::date', f.from);
      if (f.to) add(`created_at < (?::date + interval '1 day')`, f.to);
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('audit_logs')} ${w}`, p);
      const rows = await db.many(
        `select id, actor_admin_id as "actorId", actor_label as "actor", action, entity_type as "entityType", entity_id as "entityId",
                entity_name as "entityName", summary, changes, status, request_id as "requestId", created_at as "createdAt"
           from ${db.t('audit_logs')} ${w} order by created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
        p,
      );
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );
  return r;
}

// ------------------------------------------------------------------ sync jobs
export function syncRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  const JOB_SELECT = `j.id, j.source_type as "sourceType", j.source_id as "sourceId", j.operation, j.source_version as "sourceVersion",
    j.status, j.attempts, j.max_attempts as "maxAttempts", j.next_run_at as "nextRunAt", j.last_error as "lastError", j.result,
    j.created_at as "createdAt", j.started_at as "startedAt", j.completed_at as "completedAt",
    coalesce(l.name, f.question, d.title) as "sourceTitle"`;
  const JOINS = `left join ${db.t('listings')} l on j.source_type = 'listing' and l.id = j.source_id
    left join ${db.t('faqs')} f on j.source_type = 'faq' and f.id = j.source_id
    left join ${db.t('knowledge_documents')} d on j.source_type = 'document' and d.id = j.source_id`;

  r.get(
    '/jobs',
    requirePermission('knowledge:read'),
    validate({ query: z.strictObject({ ...paginationQuery, status: csv(z.enum(['pending', 'running', 'completed', 'failed', 'superseded'])).optional(), sourceType: z.enum(['listing', 'faq', 'document', 'classified']).optional(), sourceId: z.uuid().optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; status?: string[]; sourceType?: string; sourceId?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.status?.length) {
        p.push(f.status);
        where.push(`j.status = any($${p.length})`);
      }
      if (f.sourceType) {
        p.push(f.sourceType);
        where.push(`j.source_type = ${p.length}`);
      }
      if (f.sourceId) {
        p.push(f.sourceId);
        where.push(`j.source_id = ${p.length}`);
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('sync_jobs')} j ${w}`, p);
      const rows = await db.many(`select ${JOB_SELECT} from ${db.t('sync_jobs')} j ${JOINS} ${w} order by j.created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, p);
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  r.get('/summary', requirePermission('knowledge:read'), async (_req, res) => {
    const [jobs, states, heartbeat] = await Promise.all([
      db.many(`select status, count(*)::int as n from ${db.t('sync_jobs')} group by status`),
      db.many(`select source_type as "sourceType", status, count(*)::int as n from ${db.t('index_state')} group by 1, 2`),
      db.one(`select value, updated_at as "updatedAt" from ${db.t('settings')} where key = 'worker_heartbeat'`),
    ]);
    res.json({ jobs: Object.fromEntries(jobs.map((j) => [j.status, j.n])), indexState: states, worker: heartbeat ?? null, embeddings: ctx.llm.available ? 'enabled' : 'disabled (keyword-only indexing)' });
  });

  /** Retry a failed job: queues a fresh job for the source's current version. */
  r.post('/jobs/:id/retry', requirePermission('sync:manage'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    const out = await db.tx(async (client) => {
      const job = (await client.query(`select * from ${db.t('sync_jobs')} where id = $1 for update`, [id])).rows[0];
      if (!job) throw notFound('Sync job');
      if (job.status !== 'failed') throw conflict(`Only failed jobs can be retried (this one is ${job.status}).`);
      const table = job.source_type === 'listing' ? 'listings' : job.source_type === 'faq' ? 'faqs' : job.source_type === 'classified' ? 'classifieds' : 'knowledge_documents';
      const src = (await client.query(`select content_version from ${db.t(table)} where id = $1`, [job.source_id])).rows[0];
      const q = await enqueueSync(client, db, { sourceType: job.source_type, sourceId: job.source_id, operation: src ? 'upsert' : 'delete', version: src?.content_version ?? job.source_version, requestedBy: req.admin?.id });
      await client.query(`update ${db.t('sync_jobs')} set result = result || jsonb_build_object('retriedAs', $2::text) where id = $1`, [id, q.id]);
      await recordAudit(client, db, req, { action: 'sync.retry', entityType: job.source_type, entityId: job.source_id, summary: `Retry of job ${id}` });
      return q;
    });
    res.status(202).json({ jobId: out.id, coalesced: out.coalesced });
  });

  /** Re-index everything eligible (e.g. after adding an OpenAI key or changing the embedding model). */
  r.post('/reindex-all', requirePermission('sync:manage'), validate({ body: z.strictObject({ sourceType: z.enum(['listing', 'faq', 'document', 'classified']).optional(), confirm: z.literal(true) }) }), async (req, res) => {
    const { sourceType } = body<{ sourceType?: string }>(req);
    const queued = await db.tx(async (client) => {
      let n = 0;
      const sets: Array<[string, string]> = [
        ['listing', `select id, content_version from ${db.t('listings')} where status = 'published'`],
        ['faq', `select id, content_version from ${db.t('faqs')} where status = 'published'`],
        ['document', `select id, content_version from ${db.t('knowledge_documents')} where status = 'published'`],
        ['classified', `select id, content_version from ${db.t('classifieds')} where status = 'approved'`],
      ];
      for (const [type, sql] of sets) {
        if (sourceType && sourceType !== type) continue;
        const rows = (await client.query(`${sql} limit 20000`)).rows;
        await client.query(`update ${db.t('index_state')} set indexed_hash = null where source_type = $1`, [type]);
        for (const row of rows) {
          await enqueueSync(client, db, { sourceType: type as never, sourceId: row.id, operation: 'upsert', version: row.content_version, requestedBy: req.admin?.id });
          n++;
        }
      }
      await recordAudit(client, db, req, { action: 'sync.reindex_all', entityType: sourceType ?? 'all', summary: `${n} source(s) queued` });
      return n;
    });
    if (!queued) throw badRequest('There is no published content to re-index.');
    res.status(202).json({ queued, message: 'Re-indexing has been queued and runs in the background worker.' });
  });

  return r;
}

// ------------------------------------------------------------------ monitoring
export function monitoringRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  /** Real checks: database round-trip, worker heartbeat age, queue depth, configuration presence. */
  r.get('/health', requirePermission('logs:read'), async (_req, res) => {
    const ping = await db.ping();
    const [queue, heartbeat, recentErrors, migrations] = await Promise.all([
      db.one(`select count(*) filter (where status = 'pending')::int as pending, count(*) filter (where status = 'failed')::int as failed,
                     min(created_at) filter (where status = 'pending') as "oldestPending" from ${db.t('sync_jobs')}`).catch(() => null),
      db.one<{ value: { at: string }; updated_at: Date }>(`select value, updated_at from ${db.t('settings')} where key = 'worker_heartbeat'`).catch(() => null),
      db.one(`select count(*)::int as n from ${db.t('error_events')} where created_at >= now() - interval '24 hours' and not resolved`).catch(() => null),
      db.many(`select version from ${db.t('schema_migrations')} order by version`).catch(() => []),
    ]);
    const heartbeatAge = heartbeat ? Math.round((Date.now() - new Date(heartbeat.updated_at).getTime()) / 1000) : null;
    res.json({
      checkedAt: new Date().toISOString(),
      services: {
        database: { status: ping.ok ? 'up' : 'down', latencyMs: ping.latencyMs },
        worker: { status: heartbeatAge === null ? 'never_seen' : heartbeatAge < 120 ? 'up' : 'stale', lastHeartbeatSecondsAgo: heartbeatAge },
        llm: { status: ctx.llm.available ? 'configured' : 'not_configured', chatModel: ctx.llm.chatModel, embeddingModel: ctx.llm.embeddingModel, note: 'Configuration presence only — no paid test call is made.' },
      },
      queue,
      unresolvedErrors24h: recentErrors?.n ?? null,
      migrations: migrations.map((m) => m.version),
    });
  });

  r.get(
    '/errors',
    requirePermission('logs:read'),
    validate({ query: z.strictObject({ ...paginationQuery, resolved: z.enum(['true', 'false']).optional(), category: z.string().max(40).regex(/^[a-z_]+$/).optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; resolved?: string; category?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.resolved) {
        p.push(f.resolved === 'true');
        where.push(`resolved = $${p.length}`);
      }
      if (f.category) {
        p.push(f.category);
        where.push(`category = $${p.length}`);
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('error_events')} ${w}`, p);
      const rows = await db.many(
        `select id, category, severity, code, message, route, request_id as "requestId", resolved, created_at as "createdAt"
           from ${db.t('error_events')} ${w} order by created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
        p,
      );
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  r.patch('/errors/:id', requirePermission('logs:read'), validate({ params: uuidParam, body: z.strictObject({ resolved: z.boolean() }) }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    const u = await db.query(`update ${db.t('error_events')} set resolved = $2 where id = $1`, [id, body<{ resolved: boolean }>(req).resolved]);
    if (!u.rowCount) throw notFound('Error event');
    res.json({ id, resolved: body<{ resolved: boolean }>(req).resolved });
  });

  /** Retrieval diagnostics for investigating wrong answers (redacted queries, no message text). */
  r.get(
    '/retrieval-logs',
    requirePermission('logs:read'),
    validate({ query: z.strictObject({ ...paginationQuery, outcome: z.string().max(30).regex(/^[a-z_]+$/).optional(), intent: z.string().max(40).regex(/^[a-z_]+$/).optional(), conversationId: z.uuid().optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; outcome?: string; intent?: string; conversationId?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      for (const [col, v] of [['outcome', f.outcome], ['intent', f.intent], ['conversation_id', f.conversationId]] as const) {
        if (v) {
          p.push(v);
          where.push(`${col} = $${p.length}`);
        }
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('retrieval_logs')} ${w}`, p);
      const rows = await db.many(
        `select id, request_id as "requestId", conversation_id as "conversationId", normalized_query as "query", intent, filters, methods,
                candidate_count as "candidateCount", selected_sources as "selectedSources", scores, evidence_level as "evidence", outcome,
                fallback_reason as "fallbackReason", latency_ms as "latencyMs", embedding_model as "embeddingModel", chat_model as "chatModel",
                config_version as "configVersion", created_at as "createdAt"
           from ${db.t('retrieval_logs')} ${w} order by created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
        p,
      );
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  return r;
}

// ------------------------------------------------------------------ settings
/**
 * Settings documents are flat objects of display/configuration values edited in the admin
 * dashboard. Keys and value types are bounded; secrets must never be stored here (keys that look
 * like credentials are rejected).
 */
const settingValue = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.string().max(300)).max(30),
]);
const settingsDocument = z
  .record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,59}$/, 'Invalid setting name'), settingValue)
  .refine((o) => Object.keys(o).length <= 80, 'Too many settings')
  .refine((o) => !Object.keys(o).some((k) => /(secret|password|apikey|api_key|token|servicerole)/i.test(k)), 'Secrets cannot be stored in settings');
const SETTINGS_SCHEMAS = { chatbot: settingsDocument, general: settingsDocument } as const;
type SettingsKey = keyof typeof SETTINGS_SCHEMAS;

export function settingsRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  const keyParam = z.strictObject({ key: z.enum(Object.keys(SETTINGS_SCHEMAS) as [SettingsKey, ...SettingsKey[]]) });

  r.get('/:key', requirePermission('settings:read'), validate({ params: keyParam }), async (req, res) => {
    const row = await db.one(`select value, updated_at as "updatedAt" from ${db.t('settings')} where key = $1`, [params<{ key: string }>(req).key]);
    if (!row) throw notFound('Settings');
    res.json(row);
  });

  r.put('/:key', requirePermission('settings:write'), validate({ params: keyParam }), async (req, res) => {
    const key = params<{ key: SettingsKey }>(req).key;
    const parsed = SETTINGS_SCHEMAS[key].safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest('Some settings are invalid.', parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })));
    const row = await db.tx(async (client) => {
      const r1 = await client.query(
        `insert into ${db.t('settings')} (key, value, updated_by, updated_at) values ($1, $2, $3, now())
         on conflict (key) do update set value = $2, updated_by = $3, updated_at = now() returning value, updated_at as "updatedAt"`,
        [key, JSON.stringify(parsed.data), req.admin!.id],
      );
      await recordAudit(client, db, req, { action: 'settings.updated', entityType: 'settings', entityId: key });
      return r1.rows[0];
    });
    res.json(row);
  });

  return r;
}

/** Public chatbot widget configuration (display settings only). */
export function publicSettingsRoutes(ctx: AppContext) {
  const r = Router();
  r.get('/chatbot', async (_req, res) => {
    const row = await ctx.db.one<{ value: Record<string, unknown> }>(`select value from ${ctx.db.t('settings')} where key = 'chatbot'`);
    const v = row?.value ?? {};
    res.set('Cache-Control', 'public, max-age=120');
    res.json({
      enabled: v.enabled ?? true,
      /** False until a real AI model is connected (or when admins disable the assistant). */
      aiAvailable: Boolean((v.enabled ?? true) && (ctx.llm.available || !ctx.config.PUBLIC_CHAT_REQUIRES_LLM)),
      displayName: v.displayName ?? 'AI Bajan',
      welcomeMessage: v.welcomeMessage ?? '',
      widgetTitle: v.widgetTitle ?? '',
      widgetSubtitle: v.widgetSubtitle ?? '',
      brandColor: typeof v.brandColor === 'string' && /^#[0-9a-f]{6}$/i.test(v.brandColor) ? v.brandColor : null,
      suggestedQuestions: Array.isArray(v.suggestedQuestions) ? v.suggestedQuestions : [],
      showSources: v.showSources ?? v.includeSources ?? true,
      sensitiveDataNotice: v.sensitiveDataNotice ?? '',
    });
  });
  return r;
}
