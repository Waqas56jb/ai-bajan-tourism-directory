import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import { requirePermission } from '../middleware/auth.js';
import { body, csv, paged, paginationQuery, params, query, searchText, uuidParam, validate } from '../middleware/core.js';
import { createLimiter } from '../middleware/rateLimit.js';
import { afterSourceWrite, isClassifiedEligible } from '../sync/syncQueue.js';
import { badRequest, notFound } from '../utils/errors.js';
import { isSafeHttpUrl } from '../utils/text.js';

/**
 * Jobs & classified ads. Anyone can submit; nothing is shown (or used by the assistant) until an
 * administrator approves it. Every approved ad has an expiry date, after which it disappears.
 */
const KINDS = ['job', 'classified'] as const;
const STATUSES = ['pending', 'approved', 'rejected', 'expired'] as const;
const DEFAULT_EXPIRY_DAYS = 30;
const MAX_EXPIRY_DAYS = 120;

const t = (max: number) => z.string().trim().max(max);
const phone = t(40).refine((v) => v === '' || /^\+?[0-9 ()-]{7,20}$/.test(v), 'Enter a valid phone number').default('');
const date = z.iso.date();

export const classifiedSubmissionSchema = z
  .strictObject({
    kind: z.enum(KINDS),
    title: t(140).min(3, 'Add a title'),
    description: t(4000).min(10, 'Add a description (at least 10 characters)'),
    category: t(60).default(''),
    employer: t(140).default(''),
    employmentType: t(40).default(''),
    salary: t(80).default(''),
    qualifications: t(1000).default(''),
    applyUrl: t(500).refine((v) => v === '' || isSafeHttpUrl(v), 'Must be a full http(s) URL').default(''),
    applyDeadline: date.optional(),
    price: t(60).default(''),
    itemCondition: t(40).default(''),
    locationId: z.uuid().optional(),
    area: t(80).default(''),
    contactName: t(120).min(2, 'Add a contact name'),
    contactPhone: phone,
    contactWhatsapp: phone,
    contactEmail: z.union([z.email().max(200), z.literal('')]).default(''),
    requestedDays: z.number().int().min(1).max(MAX_EXPIRY_DAYS).optional(),
    consent: z.literal(true, { message: 'Please confirm the advert is genuine and you may publish it' }),
  })
  .refine((v) => v.contactPhone || v.contactWhatsapp || v.contactEmail || v.applyUrl, {
    message: 'Add at least one way to contact you',
    path: ['contactPhone'],
  })
  .refine((v) => v.kind !== 'job' || v.employer.length >= 2, { message: 'Add the employer', path: ['employer'] });

const PUBLIC_SELECT = `c.id, c.kind, c.title, c.description, c.category, c.employer, c.employment_type as "employmentType", c.salary,
  c.qualifications, c.apply_url as "applyUrl", c.apply_deadline as "applyDeadline", c.price, c.item_condition as "itemCondition",
  c.area, l.name as "locationName", c.contact_name as "contactName", c.contact_phone as "contactPhone",
  c.contact_whatsapp as "contactWhatsapp", c.contact_email as "contactEmail", c.expires_at as "expiresAt", c.created_at as "createdAt"`;
const ADMIN_SELECT = `${PUBLIC_SELECT}, c.status, c.location_id as "locationId", c.review_note as "reviewNote", c.reviewed_at as "reviewedAt", c.updated_at as "updatedAt"`;
const FROM = (db: AppContext['db']) => `${db.t('classifieds')} c left join ${db.t('locations')} l on l.id = c.location_id`;

export function publicClassifiedRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  const limiter = createLimiter(ctx.config.RATE_LIMIT_WINDOW_MS * 10, Math.max(3, ctx.config.FEEDBACK_RATE_LIMIT_MAX), false);

  r.get(
    '/',
    validate({ query: z.strictObject({ ...paginationQuery, kind: z.enum(KINDS).optional(), q: searchText(120).optional(), category: t(60).optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; kind?: string; q?: string; category?: string }>(req);
      const where = [`c.status = 'approved'`, `(c.expires_at is null or c.expires_at >= current_date)`];
      const p: unknown[] = [];
      if (f.kind) {
        p.push(f.kind);
        where.push(`c.kind = $${p.length}`);
      }
      if (f.category) {
        p.push(f.category);
        where.push(`c.category = $${p.length}`);
      }
      if (f.q) {
        p.push(`%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
        where.push(`(c.title ilike $${p.length} or c.description ilike $${p.length} or c.employer ilike $${p.length})`);
      }
      const w = where.join(' and ');
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('classifieds')} c where ${w}`, p);
      const rows = await db.many(`select ${PUBLIC_SELECT} from ${FROM(db)} where ${w} order by c.created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, p);
      res.set('Cache-Control', 'public, max-age=60');
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  r.post('/', limiter, validate({ body: classifiedSubmissionSchema }), async (req, res) => {
    const b = body<z.infer<typeof classifiedSubmissionSchema>>(req);
    const row = await db.tx(async (client) => {
      if (b.locationId) {
        const l = await client.query(`select 1 from ${db.t('locations')} where id = $1`, [b.locationId]);
        if (!l.rowCount) throw badRequest('Choose a valid location.', { field: 'locationId' });
      }
      const ins = await client.query<{ id: string }>(
        `insert into ${db.t('classifieds')}
           (kind, title, description, category, employer, employment_type, salary, qualifications, apply_url, apply_deadline,
            price, item_condition, location_id, area, contact_name, contact_phone, contact_whatsapp, contact_email, review_note)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) returning id`,
        [
          b.kind, b.title, b.description, b.category, b.employer, b.employmentType, b.salary, b.qualifications, b.applyUrl,
          b.applyDeadline ?? null, b.price, b.itemCondition, b.locationId ?? null, b.area, b.contactName, b.contactPhone,
          b.contactWhatsapp, b.contactEmail.toLowerCase(), b.requestedDays ? `Requested duration: ${b.requestedDays} days` : '',
        ],
      );
      await recordAudit(client, db, req, { action: `${b.kind}.submitted`, entityType: 'classified', entityId: ins.rows[0].id, entityName: b.title });
      return ins.rows[0];
    });
    res.status(201).json({ received: true, id: row.id, status: 'pending' });
  });

  return r;
}

export function adminClassifiedRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get(
    '/',
    requirePermission('listings:read'),
    validate({ query: z.strictObject({ ...paginationQuery, status: csv(z.enum(STATUSES)).optional(), kind: z.enum(KINDS).optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; status?: string[]; kind?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.status?.length) {
        p.push(f.status);
        where.push(`c.status = any($${p.length})`);
      }
      if (f.kind) {
        p.push(f.kind);
        where.push(`c.kind = $${p.length}`);
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('classifieds')} c ${w}`, p);
      const rows = await db.many(`select ${ADMIN_SELECT} from ${FROM(db)} ${w} order by c.created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, p);
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  /** Approve (with expiry), reject, or edit an ad. Approval makes it public and searchable by the assistant. */
  r.patch(
    '/:id',
    requirePermission('listings:publish'),
    validate({
      params: uuidParam,
      body: z
        .strictObject({
          status: z.enum(['approved', 'rejected', 'pending']).optional(),
          expiresAt: date.optional(),
          reviewNote: t(1000).optional(),
          title: t(140).min(3).optional(),
          description: t(4000).min(10).optional(),
          category: t(60).optional(),
        })
        .refine((v) => Object.keys(v).length > 0, 'No changes supplied'),
    }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<{ status?: string; expiresAt?: string; reviewNote?: string; title?: string; description?: string; category?: string }>(req);
      const today = new Date().toISOString().slice(0, 10);
      if (b.expiresAt && b.expiresAt < today) throw badRequest('The expiry date must be today or later.', { field: 'expiresAt' });
      const maxDate = new Date(Date.now() + MAX_EXPIRY_DAYS * 86400_000).toISOString().slice(0, 10);
      if (b.expiresAt && b.expiresAt > maxDate) throw badRequest(`Ads can run for at most ${MAX_EXPIRY_DAYS} days.`, { field: 'expiresAt' });
      const row = await db.tx(async (client) => {
        const cur = (await client.query<{ status: string; expires_at: string | null }>(`select status, expires_at from ${db.t('classifieds')} where id = $1 for update`, [id])).rows[0];
        if (!cur) throw notFound('Advert');
        // Approval always sets an expiry: the chosen date, the existing one, or the default period.
        const expires =
          b.expiresAt ??
          (b.status === 'approved' && (!cur.expires_at || String(cur.expires_at) < today)
            ? new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 86400_000).toISOString().slice(0, 10)
            : null);
        const u = await client.query<{ status: string; expires_at: string | null; content_version: number; title: string }>(
          `update ${db.t('classifieds')} set
              status = coalesce($2, status),
              expires_at = coalesce($3::date, expires_at),
              review_note = coalesce($4, review_note),
              title = coalesce($5, title), description = coalesce($6, description), category = coalesce($7, category),
              reviewed_by = $8, reviewed_at = now(), content_version = content_version + 1
            where id = $1 returning status, expires_at, content_version, title`,
          [id, b.status ?? null, expires, b.reviewNote ?? null, b.title ?? null, b.description ?? null, b.category ?? null, req.admin!.id],
        );
        const c = u.rows[0];
        await afterSourceWrite(client, db, { sourceType: 'classified', sourceId: id, version: c.content_version, eligible: isClassifiedEligible(c) });
        await recordAudit(client, db, req, { action: `classified.${b.status ?? 'updated'}`, entityType: 'classified', entityId: id, entityName: c.title });
        return (await client.query(`select ${ADMIN_SELECT} from ${FROM(db)} where c.id = $1`, [id])).rows[0];
      });
      res.json(row);
    },
  );

  r.delete('/:id', requirePermission('listings:delete'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    await db.tx(async (client) => {
      const d = await client.query<{ title: string; content_version: number }>(`delete from ${db.t('classifieds')} where id = $1 returning title, content_version`, [id]);
      if (!d.rowCount) throw notFound('Advert');
      await afterSourceWrite(client, db, { sourceType: 'classified', sourceId: id, version: d.rows[0].content_version + 1, eligible: false, deleted: true });
      await recordAudit(client, db, req, { action: 'classified.deleted', entityType: 'classified', entityId: id, entityName: d.rows[0].title });
    });
    res.status(204).end();
  });

  return r;
}
