import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import { buildSet } from '../database/sqlBuilder.js';
import { requirePermission } from '../middleware/auth.js';
import { body, csv, paged, paginationQuery, params, query, uuidParam, validate } from '../middleware/core.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { isSafeHttpUrl } from '../utils/text.js';

const AD_PLACEMENTS = ['homepage_banner', 'category_page', 'featured_directory', 'sidebar'] as const;
const AD_STATUSES = ['draft', 'scheduled', 'active', 'paused', 'ended', 'archived'] as const;
const FEATURED_PLACEMENTS = ['homepage', 'category', 'destination', 'chatbot'] as const;
const FEATURED_STATUSES = ['scheduled', 'active', 'paused', 'ended'] as const;
const url = z.string().trim().max(500).refine((v) => v === '' || isSafeHttpUrl(v), 'Must be a full http(s) URL');
const optionalId = z.union([z.uuid(), z.null()]);

const adFields = {
  title: z.string().trim().min(2).max(120),
  advertiserName: z.string().trim().max(120).optional(),
  placement: z.enum(AD_PLACEMENTS),
  status: z.enum(AD_STATUSES).optional(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  imageUrl: url.optional(),
  imageAlt: z.string().trim().max(200).optional(),
  targetUrl: url.optional(),
  listingId: optionalId.optional(),
  categoryId: optionalId.optional(),
  locationId: optionalId.optional(),
  internalNotes: z.string().trim().max(2000).optional(),
};
const AD_COLUMNS = {
  title: 'title',
  advertiserName: 'advertiser_name',
  placement: 'placement',
  status: 'status',
  startDate: 'start_date',
  endDate: 'end_date',
  imageUrl: 'image_url',
  imageAlt: 'image_alt',
  targetUrl: 'target_url',
  listingId: 'listing_id',
  categoryId: 'category_id',
  locationId: 'location_id',
  internalNotes: 'internal_notes',
};
const datesOk = (v: { startDate?: string; endDate?: string }) => !v.startDate || !v.endDate || v.endDate >= v.startDate;

const AD_SELECT = `id, title, advertiser_name as "advertiserName", placement, status, start_date as "startDate", end_date as "endDate",
  image_url as "imageUrl", image_alt as "imageAlt", target_url as "targetUrl", listing_id as "listingId", category_id as "categoryId",
  location_id as "locationId", internal_notes as "internalNotes", impressions, clicks, created_at as "createdAt", updated_at as "updatedAt"`;

export function adRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get(
    '/',
    requirePermission('ads:read'),
    validate({ query: z.strictObject({ ...paginationQuery, status: csv(z.enum(AD_STATUSES)).optional(), placement: z.enum(AD_PLACEMENTS).optional() }) }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; status?: string[]; placement?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.status?.length) {
        p.push(f.status);
        where.push(`status = any($${p.length})`);
      }
      if (f.placement) {
        p.push(f.placement);
        where.push(`placement = $${p.length}`);
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('ads')} ${w}`, p);
      const rows = await db.many(`select ${AD_SELECT} from ${db.t('ads')} ${w} order by start_date desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, p);
      res.json(paged(rows, total?.n ?? 0, f.page, f.pageSize));
    },
  );

  r.get('/:id', requirePermission('ads:read'), validate({ params: uuidParam }), async (req, res) => {
    const row = await db.one(`select ${AD_SELECT} from ${db.t('ads')} where id = $1`, [params<{ id: string }>(req).id]);
    if (!row) throw notFound('Advertisement');
    res.json(row);
  });

  r.post('/', requirePermission('ads:write'), validate({ body: z.strictObject(adFields).refine(datesOk, { message: 'End date must be on or after the start date', path: ['endDate'] }) }), async (req, res) => {
    const b = body<Record<string, unknown>>(req);
    const row = await db.tx(async (client) => {
      const { sets, params: p } = buildSet(b, AD_COLUMNS);
      const cols = sets.map((s) => s.split(' = ')[0]);
      p.push(req.admin?.id ?? null);
      const created = (await client.query(`insert into ${db.t('ads')} (${[...cols, 'created_by'].join(', ')}) values (${p.map((_, i) => `$${i + 1}`).join(', ')}) returning ${AD_SELECT}`, p)).rows[0];
      await recordAudit(client, db, req, { action: 'ad.created', entityType: 'ad', entityId: created.id, entityName: created.title });
      return created;
    });
    res.status(201).json(row);
  });

  r.patch(
    '/:id',
    requirePermission('ads:write'),
    validate({ params: uuidParam, body: z.strictObject({ ...adFields, title: adFields.title.optional(), placement: adFields.placement.optional(), startDate: adFields.startDate.optional(), endDate: adFields.endDate.optional() }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<Record<string, unknown> & { startDate?: string; endDate?: string }>(req);
      const row = await db.tx(async (client) => {
        const cur = (await client.query(`select start_date, end_date from ${db.t('ads')} where id = $1 for update`, [id])).rows[0];
        if (!cur) throw notFound('Advertisement');
        if (!datesOk({ startDate: b.startDate ?? cur.start_date, endDate: b.endDate ?? cur.end_date })) throw badRequest('End date must be on or after the start date.', { field: 'endDate' });
        const { sets, params: p } = buildSet(b, AD_COLUMNS);
        if (!sets.length) throw badRequest('No changes supplied.');
        p.push(id);
        const updated = (await client.query(`update ${db.t('ads')} set ${sets.join(', ')} where id = $${p.length} returning ${AD_SELECT}`, p)).rows[0];
        await recordAudit(client, db, req, { action: 'ad.updated', entityType: 'ad', entityId: id, entityName: updated.title });
        return updated;
      });
      res.json(row);
    },
  );

  r.delete('/:id', requirePermission('ads:write'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    await db.tx(async (client) => {
      const del = await client.query(`delete from ${db.t('ads')} where id = $1 returning title`, [id]);
      if (!del.rowCount) throw notFound('Advertisement');
      await recordAudit(client, db, req, { action: 'ad.deleted', entityType: 'ad', entityId: id, entityName: del.rows[0].title });
    });
    res.status(204).end();
  });

  return r;
}

const featuredFields = {
  listingId: z.uuid(),
  placement: z.enum(FEATURED_PLACEMENTS),
  position: z.number().int().min(1).max(50).optional(),
  status: z.enum(FEATURED_STATUSES).optional(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  notes: z.string().trim().max(1000).optional(),
};
const FEATURED_COLUMNS = { listingId: 'listing_id', placement: 'placement', position: 'position', status: 'status', startDate: 'start_date', endDate: 'end_date', notes: 'notes' };
const FEATURED_SELECT = `f.id, f.listing_id as "listingId", l.name as "listingName", l.status as "listingStatus", f.placement, f.position, f.status,
  f.start_date as "startDate", f.end_date as "endDate", f.notes, f.created_at as "createdAt", f.updated_at as "updatedAt"`;

export function featuredRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  const t = db.t('featured_listings');

  /** One active/scheduled placement per listing+placement with overlapping dates. */
  async function assertNoOverlap(q: { query: typeof db.query }, v: { listingId: string; placement: string; startDate: string; endDate: string }, excludeId?: string) {
    const clash = await q.query(
      `select id from ${t} where listing_id = $1 and placement = $2 and status in ('scheduled','active','paused')
          and daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]') and ($5::uuid is null or id <> $5)`,
      [v.listingId, v.placement, v.startDate, v.endDate, excludeId ?? null],
    );
    if (clash.rowCount) throw conflict('This listing already has that placement for overlapping dates.');
  }

  r.get('/', requirePermission('ads:read'), validate({ query: z.strictObject({ placement: z.enum(FEATURED_PLACEMENTS).optional() }) }), async (req, res) => {
    const f = query<{ placement?: string }>(req);
    const rows = await db.many(
      `select ${FEATURED_SELECT} from ${t} f join ${db.t('listings')} l on l.id = f.listing_id ${f.placement ? 'where f.placement = $1' : ''}
        order by f.placement, f.position, f.start_date limit 500`,
      f.placement ? [f.placement] : [],
    );
    res.json({ items: rows });
  });

  r.post('/', requirePermission('ads:write'), validate({ body: z.strictObject(featuredFields).refine(datesOk, { message: 'End date must be on or after the start date', path: ['endDate'] }) }), async (req, res) => {
    const b = body<z.infer<z.ZodObject<typeof featuredFields>>>(req);
    const row = await db.tx(async (client) => {
      const listing = await client.query(`select status from ${db.t('listings')} where id = $1`, [b.listingId]);
      if (!listing.rowCount) throw badRequest('The listing does not exist.', { field: 'listingId' });
      if (listing.rows[0].status !== 'published') throw badRequest('Only published listings can be featured.', { field: 'listingId' });
      await assertNoOverlap(client as never, b);
      const { sets, params: p } = buildSet(b, FEATURED_COLUMNS);
      const cols = sets.map((s) => s.split(' = ')[0]);
      p.push(req.admin?.id ?? null);
      const id = (await client.query(`insert into ${t} (${[...cols, 'created_by'].join(', ')}) values (${p.map((_, i) => `$${i + 1}`).join(', ')}) returning id`, p)).rows[0].id;
      await recordAudit(client, db, req, { action: 'featured.created', entityType: 'featured_listing', entityId: id });
      return (await client.query(`select ${FEATURED_SELECT} from ${t} f join ${db.t('listings')} l on l.id = f.listing_id where f.id = $1`, [id])).rows[0];
    });
    res.status(201).json(row);
  });

  r.patch(
    '/:id',
    requirePermission('ads:write'),
    validate({ params: uuidParam, body: z.strictObject({ position: featuredFields.position, status: featuredFields.status, startDate: featuredFields.startDate.optional(), endDate: featuredFields.endDate.optional(), notes: featuredFields.notes }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<Record<string, unknown> & { startDate?: string; endDate?: string }>(req);
      const row = await db.tx(async (client) => {
        const cur = (await client.query(`select * from ${t} where id = $1 for update`, [id])).rows[0];
        if (!cur) throw notFound('Featured placement');
        const merged = { listingId: cur.listing_id, placement: cur.placement, startDate: b.startDate ?? cur.start_date, endDate: b.endDate ?? cur.end_date };
        if (!datesOk(merged)) throw badRequest('End date must be on or after the start date.', { field: 'endDate' });
        await assertNoOverlap(client as never, merged, id);
        const { sets, params: p } = buildSet(b, FEATURED_COLUMNS);
        if (!sets.length) throw badRequest('No changes supplied.');
        p.push(id);
        await client.query(`update ${t} set ${sets.join(', ')} where id = $${p.length}`, p);
        await recordAudit(client, db, req, { action: 'featured.updated', entityType: 'featured_listing', entityId: id });
        return (await client.query(`select ${FEATURED_SELECT} from ${t} f join ${db.t('listings')} l on l.id = f.listing_id where f.id = $1`, [id])).rows[0];
      });
      res.json(row);
    },
  );

  r.delete('/:id', requirePermission('ads:write'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    await db.tx(async (client) => {
      const del = await client.query(`delete from ${t} where id = $1`, [id]);
      if (!del.rowCount) throw notFound('Featured placement');
      await recordAudit(client, db, req, { action: 'featured.deleted', entityType: 'featured_listing', entityId: id });
    });
    res.status(204).end();
  });

  return r;
}

/** Public: currently running ads for a placement. Internal notes and counters are never exposed. */
export function publicAdRoutes(ctx: AppContext) {
  const r = Router();
  r.get('/', validate({ query: z.strictObject({ placement: z.enum(AD_PLACEMENTS) }) }), async (req, res) => {
    const rows = await ctx.db.many(
      `select id, title, image_url as "imageUrl", image_alt as "imageAlt", target_url as "targetUrl", listing_id as "listingId"
         from ${ctx.db.t('ads')} where placement = $1 and status = 'active' and current_date between start_date and end_date
        order by start_date limit 10`,
      [query<{ placement: string }>(req).placement],
    );
    res.set('Cache-Control', 'public, max-age=120');
    res.json({ items: rows });
  });
  return r;
}
