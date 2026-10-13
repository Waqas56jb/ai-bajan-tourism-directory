import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import { requirePermission } from '../middleware/auth.js';
import { body, csv, paged, paginationQuery, params, query, uuidParam, validate, searchText } from '../middleware/core.js';
import { notFound } from '../utils/errors.js';

const OUTCOMES = ['answered', 'partial', 'fallback', 'error'] as const;
const REVIEW = ['unreviewed', 'reviewed', 'flagged'] as const;

export function conversationAdminRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get(
    '/',
    requirePermission('conversations:read'),
    validate({
      query: z.strictObject({
        ...paginationQuery,
        outcome: csv(z.enum(OUTCOMES)).optional(),
        reviewStatus: csv(z.enum(REVIEW)).optional(),
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
        q: searchText(120).optional(),
      }),
    }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; outcome?: string[]; reviewStatus?: string[]; from?: string; to?: string; q?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      const add = (sql: string, v: unknown) => {
        p.push(v);
        where.push(sql.replace('?', `$${p.length}`));
      };
      if (f.outcome?.length) add('c.outcome = any(?)', f.outcome);
      if (f.reviewStatus?.length) add('c.review_status = any(?)', f.reviewStatus);
      if (f.from) add('c.started_at >= ?::date', f.from);
      if (f.to) add(`c.started_at < (?::date + interval '1 day')`, f.to);
      if (f.q) add(`exists (select 1 from ${db.t('messages')} m where m.conversation_id = c.id and m.content ilike '%' || ? || '%')`, f.q.replace(/[\\%_]/g, (m) => `\\${m}`));
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('conversations')} c ${w}`, p);
      const rows = await db.many(
        `select c.id, c.language, c.status, c.review_status as "reviewStatus", c.outcome, c.message_count as "messageCount",
                c.started_at as "startedAt", c.last_activity_at as "lastActivityAt", c.summary,
                (select content from ${db.t('messages')} m where m.conversation_id = c.id and m.role = 'user' order by created_at limit 1) as "firstQuestion",
                (select count(*)::int from ${db.t('feedback')} fb where fb.conversation_id = c.id and fb.helpful = false) as "negativeFeedback"
           from ${db.t('conversations')} c ${w}
          order by c.last_activity_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
        p,
      );
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  async function detail(id: string) {
    const conv = await db.one(
      `select id, language, status, review_status as "reviewStatus", outcome, message_count as "messageCount", summary,
              memory_state as "memoryState", started_at as "startedAt", last_activity_at as "lastActivityAt"
         from ${db.t('conversations')} where id = $1`,
      [id],
    );
    if (!conv) throw notFound('Conversation');
    const [messages, notes, diagnostics] = await Promise.all([
      db.many(
        `select id, role, content, sources, answer_meta as meta, error_code as "errorCode", created_at as "createdAt"
           from ${db.t('messages')} where conversation_id = $1 order by created_at limit 1000`,
        [id],
      ),
      db.many(
        `select n.id, n.note, n.created_at as "createdAt", a.display_name as "author"
           from ${db.t('conversation_notes')} n left join ${db.t('admins')} a on a.id = n.admin_id
          where n.conversation_id = $1 order by n.created_at`,
        [id],
      ),
      db.many(
        `select message_id as "messageId", intent, evidence_level as "evidence", outcome, fallback_reason as "fallbackReason",
                methods, candidate_count as "candidateCount", selected_sources as "selectedSources", scores, filters,
                latency_ms as "latencyMs", config_version as "configVersion", created_at as "createdAt"
           from ${db.t('retrieval_logs')} where conversation_id = $1 order by created_at limit 500`,
        [id],
      ),
    ]);
    return { ...conv, messages, notes, diagnostics };
  }

  r.get('/:id', requirePermission('conversations:read'), validate({ params: uuidParam }), async (req, res) => {
    res.json(await detail(params<{ id: string }>(req).id));
  });

  r.get('/:id/export', requirePermission('conversations:export'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    const data = await detail(id);
    await recordAudit(db, db, req, { action: 'conversation.exported', entityType: 'conversation', entityId: id });
    res.setHeader('Content-Disposition', `attachment; filename="conversation-${id}.json"`);
    res.json(data);
  });

  r.post(
    '/:id/review',
    requirePermission('conversations:review'),
    validate({ params: uuidParam, body: z.strictObject({ reviewStatus: z.enum(REVIEW) }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const { reviewStatus } = body<{ reviewStatus: string }>(req);
      await db.tx(async (client) => {
        const r1 = await client.query(`update ${db.t('conversations')} set review_status = $2 where id = $1`, [id, reviewStatus]);
        if (!r1.rowCount) throw notFound('Conversation');
        await recordAudit(client, db, req, { action: `conversation.${reviewStatus}`, entityType: 'conversation', entityId: id });
      });
      res.json({ id, reviewStatus });
    },
  );

  r.post(
    '/:id/notes',
    requirePermission('conversations:review'),
    validate({ params: uuidParam, body: z.strictObject({ note: z.string().trim().min(1).max(2000) }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const note = await db.tx(async (client) => {
        const exists = await client.query(`select 1 from ${db.t('conversations')} where id = $1`, [id]);
        if (!exists.rowCount) throw notFound('Conversation');
        const n = await client.query(
          `insert into ${db.t('conversation_notes')} (conversation_id, admin_id, note) values ($1, $2, $3) returning id, note, created_at as "createdAt"`,
          [id, req.admin!.id, body<{ note: string }>(req).note],
        );
        await recordAudit(client, db, req, { action: 'conversation.note_added', entityType: 'conversation', entityId: id });
        return n.rows[0];
      });
      res.status(201).json(note);
    },
  );

  return r;
}
