import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import { visitorKey } from '../auth/visitorToken.js';
import { visitorSession, requirePermission } from '../middleware/auth.js';
import { body, csv, paged, paginationQuery, params, query, uuidParam, validate } from '../middleware/core.js';
import { createLimiter } from '../middleware/rateLimit.js';
import { badRequest, notFound } from '../utils/errors.js';
import { isSafeHttpUrl } from '../utils/text.js';

const TYPES = ['answer_rating', 'incorrect_answer', 'missing_info', 'incorrect_location', 'broken_link', 'outdated', 'general'] as const;
const STATUSES = ['new', 'reviewed', 'resolved', 'reopened'] as const;

export const publicFeedbackSchema = z
  .strictObject({
    type: z.enum(TYPES),
    helpful: z.boolean().optional(),
    message: z.string().trim().max(2000).default(''),
    conversationId: z.uuid().optional(),
    messageId: z.uuid().optional(),
    listingId: z.uuid().optional(),
    pageUrl: z.string().trim().max(500).refine((v) => v === '' || isSafeHttpUrl(v), 'Must be an http(s) URL').optional(),
    contactEmail: z.union([z.email().max(200), z.literal('')]).optional(),
  })
  .refine((v) => v.type !== 'answer_rating' || typeof v.helpful === 'boolean', { message: 'helpful is required for answer ratings', path: ['helpful'] })
  .refine((v) => v.type === 'answer_rating' || v.message.length >= 3, { message: 'Please describe the problem', path: ['message'] });

export function publicFeedbackRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  const limiter = createLimiter(ctx.config.RATE_LIMIT_WINDOW_MS, ctx.config.FEEDBACK_RATE_LIMIT_MAX, true);

  r.post('/', visitorSession(ctx, { mint: false }), limiter, validate({ body: publicFeedbackSchema }), async (req, res) => {
    const b = body<z.infer<typeof publicFeedbackSchema>>(req);
    // Feedback about a conversation is only accepted from the visitor who owns it.
    if (b.conversationId || b.messageId) {
      if (!req.visitorId) throw badRequest('A valid chat session is required to rate a conversation.');
      const owned = await db.one(
        `select c.id from ${db.t('conversations')} c
          where c.id = coalesce($1::uuid, (select conversation_id from ${db.t('messages')} where id = $2::uuid)) and c.visitor_key = $3
            and ($2::uuid is null or exists (select 1 from ${db.t('messages')} m where m.id = $2::uuid and m.conversation_id = c.id))`,
        [b.conversationId ?? null, b.messageId ?? null, visitorKey(req.visitorId)],
      );
      if (!owned) throw notFound('Conversation');
      b.conversationId = owned.id as string;
    }
    const priority = b.type === 'incorrect_answer' || b.type === 'incorrect_location' ? 'high' : b.type === 'answer_rating' ? 'low' : 'medium';
    const row = await db.one<{ id: string }>(
      `insert into ${db.t('feedback')} (type, priority, helpful, message, conversation_id, message_id, listing_id, page_url, contact_email)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [b.type, priority, b.helpful ?? null, b.message, b.conversationId ?? null, b.messageId ?? null, b.listingId ?? null, b.pageUrl ?? '', b.contactEmail ?? ''],
    );
    if (b.conversationId && b.helpful === false) {
      await db.query(`update ${db.t('conversations')} set feedback_summary = jsonb_set(feedback_summary, '{negative}', to_jsonb(coalesce((feedback_summary->>'negative')::int, 0) + 1)) where id = $1`, [b.conversationId]);
    }
    res.status(201).json({ id: row!.id, received: true });
  });

  return r;
}

export function adminFeedbackRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get(
    '/',
    requirePermission('feedback:read'),
    validate({ query: z.strictObject({ ...paginationQuery, status: csv(z.enum(STATUSES)).optional(), type: csv(z.enum(TYPES)).optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; status?: string[]; type?: string[] }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.status?.length) {
        p.push(f.status);
        where.push(`f.status = any($${p.length})`);
      }
      if (f.type?.length) {
        p.push(f.type);
        where.push(`f.type = any($${p.length})`);
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('feedback')} f ${w}`, p);
      const rows = await db.many(
        `select f.id, f.type, f.status, f.priority, f.helpful, f.message, f.conversation_id as "conversationId", f.message_id as "messageId",
                f.listing_id as "listingId", l.name as "listingName", f.page_url as "pageUrl", f.contact_email as "contactEmail",
                f.admin_notes as "notes", f.resolved_at as "resolvedAt", f.created_at as "createdAt", f.updated_at as "updatedAt"
           from ${db.t('feedback')} f left join ${db.t('listings')} l on l.id = f.listing_id ${w}
          order by f.created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
        p,
      );
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  r.patch(
    '/:id',
    requirePermission('feedback:manage'),
    validate({
      params: uuidParam,
      body: z
        .strictObject({ status: z.enum(STATUSES).optional(), priority: z.enum(['high', 'medium', 'low']).optional(), note: z.string().trim().min(1).max(2000).optional() })
        .refine((v) => Object.keys(v).length > 0, 'No changes supplied'),
    }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<{ status?: string; priority?: string; note?: string }>(req);
      const row = await db.tx(async (client) => {
        const note = b.note ? JSON.stringify([{ text: b.note, by: req.admin!.displayName || req.admin!.email, at: new Date().toISOString() }]) : '[]';
        const r1 = await client.query(
          `update ${db.t('feedback')} set status = coalesce($2, status), priority = coalesce($3, priority),
                  admin_notes = admin_notes || $4::jsonb,
                  resolved_by = case when $2 = 'resolved' then $5 else resolved_by end,
                  resolved_at = case when $2 = 'resolved' then now() when $2 = 'reopened' then null else resolved_at end
            where id = $1 returning id, status, priority, admin_notes as notes`,
          [id, b.status ?? null, b.priority ?? null, note, req.admin!.id],
        );
        if (!r1.rowCount) throw notFound('Feedback');
        await recordAudit(client, db, req, { action: b.status ? `feedback.${b.status}` : 'feedback.updated', entityType: 'feedback', entityId: id });
        return r1.rows[0];
      });
      res.json(row);
    },
  );

  return r;
}
