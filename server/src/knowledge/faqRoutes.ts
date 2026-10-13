import { Router, type Request } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import type { Database, Queryable } from '../database/db.js';
import { buildSet, likeEscape } from '../database/sqlBuilder.js';
import { requirePermission } from '../middleware/auth.js';
import { body, csv, paged, paginationQuery, params, query, uuidParam, validate, searchText } from '../middleware/core.js';
import { hasPermission } from '../auth/permissions.js';
import { afterSourceWrite, isFaqEligible } from '../sync/syncQueue.js';
import { badRequest, forbidden, notFound } from '../utils/errors.js';
import { cleanText, sha256 } from '../utils/text.js';

const FAQ_STATUSES = ['draft', 'published', 'archived'] as const;
const APPROVAL = ['pending', 'approved', 'rejected'] as const;
const optionalId = z.union([z.uuid(), z.null()]);

const faqFields = {
  question: z.string().trim().min(5, 'Question is required').max(300),
  answer: z.string().trim().min(2, 'Answer is required').max(5000),
  categoryId: optionalId.optional(),
  locationId: optionalId.optional(),
  relatedListingId: optionalId.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  status: z.enum(FAQ_STATUSES).optional(),
  approvalStatus: z.enum(APPROVAL).optional(),
  includeInChatbot: z.boolean().optional(),
  order: z.number().int().min(0).max(100000).optional(),
};
const COLUMNS = {
  question: 'question',
  answer: 'answer',
  categoryId: 'category_id',
  locationId: 'location_id',
  relatedListingId: 'related_listing_id',
  tags: 'tags',
  status: 'status',
  approvalStatus: 'approval_status',
  includeInChatbot: 'include_in_chatbot',
  order: 'display_order',
  contentHash: 'content_hash',
};

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category_id: string | null;
  location_id: string | null;
  related_listing_id: string | null;
  tags: string[];
  status: string;
  approval_status: string;
  include_in_chatbot: boolean;
  display_order: number;
  content_hash: string;
  content_version: number;
  index_status: string | null;
  last_indexed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const toFaq = (r: FaqRow) => ({
  id: r.id,
  question: r.question,
  answer: r.answer,
  categoryId: r.category_id,
  locationId: r.location_id,
  relatedListingId: r.related_listing_id,
  tags: r.tags,
  status: r.status,
  approvalStatus: r.approval_status,
  includeInChatbot: r.include_in_chatbot,
  order: r.display_order,
  indexingStatus: r.index_status ?? 'not_indexed',
  lastIndexedAt: r.last_indexed_at,
  version: r.content_version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const select = (db: Database) => `
  select f.*, s.status as index_status, s.last_indexed_at from ${db.t('faqs')} f
  left join ${db.t('index_state')} s on s.source_type = 'faq' and s.source_id = f.id`;

/** Publishing or approving needs knowledge:publish; publishing implies approval unless stated. */
function checkPublishRights(req: Request, b: { status?: string; approvalStatus?: string }) {
  const publishing = b.status === 'published' || b.approvalStatus !== undefined;
  if (publishing && !hasPermission(req.admin?.role, 'knowledge:publish')) throw forbidden('Publishing or approving requires the knowledge:publish permission.');
  if (b.status === 'published' && b.approvalStatus === undefined) b.approvalStatus = 'approved';
}

async function load(q: Queryable, db: Database, id: string) {
  const r = await q.query<FaqRow>(`${select(db)} where f.id = $1`, [id]);
  if (!r.rowCount) throw notFound('FAQ');
  return r.rows[0];
}

export function faqRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get(
    '/',
    requirePermission('knowledge:read'),
    validate({
      query: z.strictObject({
        ...paginationQuery,
        pageSize: z.coerce.number().int().min(1).max(200).default(50),
        q: searchText(120).optional(),
        status: csv(z.enum(FAQ_STATUSES)).optional(),
        categoryId: z.uuid().optional(),
      }),
    }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; q?: string; status?: string[]; categoryId?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.q) {
        p.push(`%${likeEscape(f.q)}%`);
        where.push(`(f.question ilike $${p.length} escape '\\' or f.answer ilike $${p.length} escape '\\')`);
      }
      if (f.status?.length) {
        p.push(f.status);
        where.push(`f.status = any($${p.length})`);
      }
      if (f.categoryId) {
        p.push(f.categoryId);
        where.push(`f.category_id = $${p.length}`);
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('faqs')} f ${w}`, p);
      const rows = await db.many<FaqRow>(`${select(db)} ${w} order by f.display_order, f.created_at limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, p);
      res.json(paged(rows.map(toFaq), total?.n ?? 0, f.page, f.pageSize));
    },
  );

  r.get('/:id', requirePermission('knowledge:read'), validate({ params: uuidParam }), async (req, res) => {
    res.json(toFaq(await load(db, db, params<{ id: string }>(req).id)));
  });

  r.post('/', requirePermission('knowledge:write'), validate({ body: z.strictObject(faqFields) }), async (req, res) => {
    const b = body<Record<string, unknown> & { question: string; answer: string; status?: string; approvalStatus?: string }>(req);
    checkPublishRights(req, b);
    const row = await db.tx(async (client) => {
      const values = { ...b, contentHash: sha256(`${cleanText(b.question)}\n${cleanText(b.answer)}`) };
      const { sets, params: p } = buildSet(values, COLUMNS);
      const cols = sets.map((s) => s.split(' = ')[0]);
      p.push(req.admin?.id ?? null, req.admin?.id ?? null);
      const id = (
        await client.query<{ id: string }>(
          `insert into ${db.t('faqs')} (${[...cols, 'created_by', 'updated_by'].join(', ')}) values (${p.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
          p,
        )
      ).rows[0].id;
      const created = await load(client, db, id);
      await afterSourceWrite(client, db, { sourceType: 'faq', sourceId: id, version: created.content_version, eligible: isFaqEligible(created), requestedBy: req.admin?.id });
      await recordAudit(client, db, req, { action: 'faq.created', entityType: 'faq', entityId: id, entityName: created.question });
      return load(client, db, id);
    });
    res.status(201).json(toFaq(row));
  });

  r.patch(
    '/:id',
    requirePermission('knowledge:write'),
    validate({
      params: uuidParam,
      body: z.strictObject({ ...faqFields, question: faqFields.question.optional(), answer: faqFields.answer.optional() }),
    }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<Record<string, unknown> & { question?: string; answer?: string; status?: string; approvalStatus?: string }>(req);
      checkPublishRights(req, b);
      const row = await db.tx(async (client) => {
        const current = (await client.query<FaqRow>(`select * from ${db.t('faqs')} where id = $1 for update`, [id])).rows[0];
        if (!current) throw notFound('FAQ');
        const q = b.question ?? current.question;
        const a = b.answer ?? current.answer;
        const { sets, params: p } = buildSet({ ...b, contentHash: sha256(`${cleanText(q)}\n${cleanText(a)}`) }, COLUMNS);
        p.push(req.admin?.id ?? null, id);
        await client.query(
          `update ${db.t('faqs')} set ${sets.join(', ')}, updated_by = $${p.length - 1}, content_version = content_version + 1 where id = $${p.length}`,
          p,
        );
        const updated = await load(client, db, id);
        await afterSourceWrite(client, db, { sourceType: 'faq', sourceId: id, version: updated.content_version, eligible: isFaqEligible(updated), requestedBy: req.admin?.id });
        await recordAudit(client, db, req, {
          action: b.status && b.status !== current.status ? `faq.${b.status}` : 'faq.updated',
          entityType: 'faq',
          entityId: id,
          entityName: updated.question,
        });
        return load(client, db, id);
      });
      res.json(toFaq(row));
    },
  );

  r.post(
    '/bulk-status',
    requirePermission('knowledge:publish'),
    validate({ body: z.strictObject({ ids: z.array(z.uuid()).min(1).max(100), status: z.enum(FAQ_STATUSES) }) }),
    async (req, res) => {
      const b = body<{ ids: string[]; status: string }>(req);
      const affected = await db.tx(async (client) => {
        const rows = await client.query<FaqRow>(
          `update ${db.t('faqs')} set status = $2,
                  approval_status = case when $2 = 'published' then 'approved' else approval_status end,
                  content_version = content_version + 1, updated_by = $3
            where id = any($1) returning *`,
          [[...new Set(b.ids)], b.status, req.admin?.id ?? null],
        );
        for (const f of rows.rows) {
          await afterSourceWrite(client, db, { sourceType: 'faq', sourceId: f.id, version: f.content_version, eligible: isFaqEligible(f), requestedBy: req.admin?.id });
        }
        await recordAudit(client, db, req, { action: `faq.bulk_${b.status}`, entityType: 'faq', summary: `${rows.rowCount} FAQ(s) → ${b.status}` });
        return rows.rowCount ?? 0;
      });
      if (!affected) throw badRequest('None of the selected FAQs exist.');
      res.json({ affected });
    },
  );

  r.delete('/:id', requirePermission('knowledge:write'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    await db.tx(async (client) => {
      const current = (await client.query<FaqRow>(`delete from ${db.t('faqs')} where id = $1 returning *`, [id])).rows[0];
      if (!current) throw notFound('FAQ');
      await afterSourceWrite(client, db, { sourceType: 'faq', sourceId: id, version: current.content_version + 1, eligible: false, deleted: true, requestedBy: req.admin?.id });
      await recordAudit(client, db, req, { action: 'faq.deleted', entityType: 'faq', entityId: id, entityName: current.question });
    });
    res.status(204).end();
  });

  return r;
}

/** Public FAQ list: published + approved only. */
export function publicFaqRoutes(ctx: AppContext) {
  const r = Router();
  r.get('/', async (_req, res) => {
    const rows = await ctx.db.many(
      `select id, question, answer, category_id as "categoryId", location_id as "locationId", tags
         from ${ctx.db.t('faqs')} where status = 'published' and approval_status = 'approved'
        order by display_order, created_at limit 200`,
    );
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ items: rows });
  });
  return r;
}
