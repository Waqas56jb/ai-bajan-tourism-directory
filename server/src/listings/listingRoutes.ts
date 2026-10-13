import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { requirePermission } from '../middleware/auth.js';
import { body, paged, params, query, uuidParam, validate } from '../middleware/core.js';
import { likeEscape } from '../database/sqlBuilder.js';
import { notFound } from '../utils/errors.js';
import { recordAudit } from '../audit/auditService.js';
import { enqueueSync } from '../sync/syncQueue.js';
import { toAdminListing, toPublicListing, type ListingRow } from './listingMapper.js';
import {
  adminListQuery,
  bulkSchema,
  createListingSchema,
  publicListQuery,
  statusChangeSchema,
  updateListingSchema,
  type CreateListingInput,
  type UpdateListingInput,
} from './listingSchemas.js';
import {
  bulkListings,
  createListing,
  deleteListing,
  getListingRow,
  isSlugAvailable,
  listingRevisions,
  listingSelect,
  listListings,
  setListingFeatured,
  setListingStatus,
  updateListing,
  type ListFilters,
} from './listingService.js';

export function adminListingRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get('/', requirePermission('listings:read'), validate({ query: adminListQuery }), async (req, res) => {
    const f = query<ListFilters>(req);
    const { rows, total } = await listListings(db, f);
    res.json(paged(rows.map(toAdminListing), total, f.page, f.pageSize));
  });

  r.get(
    '/slug-available',
    requirePermission('listings:read'),
    validate({ query: z.strictObject({ slug: z.string().trim().min(1).max(80), excludeId: z.uuid().optional() }) }),
    async (req, res) => {
      const qy = query<{ slug: string; excludeId?: string }>(req);
      res.json(await isSlugAvailable(db, qy.slug, qy.excludeId));
    },
  );

  r.get('/:id', requirePermission('listings:read'), validate({ params: uuidParam }), async (req, res) => {
    res.json(toAdminListing(await getListingRow(db, db, params<{ id: string }>(req).id)));
  });

  /** What the public page would show, regardless of the listing's current status. */
  r.get('/:id/preview', requirePermission('listings:read'), validate({ params: uuidParam }), async (req, res) => {
    const row = await getListingRow(db, db, params<{ id: string }>(req).id);
    res.json({ status: row.status, listing: toPublicListing(row) });
  });

  r.get('/:id/revisions', requirePermission('listings:read'), validate({ params: uuidParam }), async (req, res) => {
    res.json({ items: await listingRevisions(db, params<{ id: string }>(req).id) });
  });

  r.post('/', requirePermission('listings:write'), validate({ body: createListingSchema }), async (req, res) => {
    res.status(201).json(await createListing(ctx, req, body<CreateListingInput>(req)));
  });

  r.patch('/:id', requirePermission('listings:write'), validate({ params: uuidParam, body: updateListingSchema }), async (req, res) => {
    res.json(await updateListing(ctx, req, params<{ id: string }>(req).id, body<UpdateListingInput>(req)));
  });

  r.post(
    '/:id/status',
    requirePermission('listings:publish'),
    validate({ params: uuidParam, body: statusChangeSchema }),
    async (req, res) => {
      const b = body<{ status: string; reason?: string; feedback?: string }>(req);
      res.json(await setListingStatus(ctx, req, params<{ id: string }>(req).id, b.status, b));
    },
  );

  r.post(
    '/:id/featured',
    requirePermission('listings:write'),
    validate({ params: uuidParam, body: z.strictObject({ featured: z.boolean() }) }),
    async (req, res) => {
      res.json(await setListingFeatured(ctx, req, params<{ id: string }>(req).id, body<{ featured: boolean }>(req).featured));
    },
  );

  /** "Verified by AI Bajan": set after the team has checked the business's details. */
  r.post(
    '/:id/verified',
    requirePermission('listings:publish'),
    validate({ params: uuidParam, body: z.strictObject({ verified: z.boolean() }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const { verified } = body<{ verified: boolean }>(req);
      const row = await db.tx(async (client) => {
        const u = await client.query<{ content_version: number; status: string; include_in_chatbot: boolean }>(
          `update ${db.t('listings')} set verified = $2, verified_at = case when $2 then now() else null end,
                  content_version = content_version + 1, updated_by = $3
            where id = $1 returning content_version, status, include_in_chatbot`,
          [id, verified, req.admin!.id],
        );
        if (!u.rowCount) throw notFound('Listing');
        await enqueueSync(client, db, { sourceType: 'listing', sourceId: id, operation: 'upsert', version: u.rows[0].content_version, requestedBy: req.admin!.id });
        await recordAudit(client, db, req, { action: verified ? 'listing.verified' : 'listing.unverified', entityType: 'listing', entityId: id });
        return getListingRow(client, db, id);
      });
      res.json(toAdminListing(row));
    },
  );

  r.delete('/:id', requirePermission('listings:delete'), validate({ params: uuidParam }), async (req, res) => {
    await deleteListing(ctx, req, params<{ id: string }>(req).id);
    res.status(204).end();
  });

  r.post('/bulk', validate({ body: bulkSchema }), async (req, res, next) => {
    const b = body<{ action: string; ids: string[] }>(req);
    const needed = b.action === 'delete' ? 'listings:delete' : ['feature', 'unfeature'].includes(b.action) ? 'listings:write' : 'listings:publish';
    requirePermission(needed)(req, res, async (err?: unknown) => {
      if (err) return next(err);
      try {
        res.json(await bulkListings(ctx, req, b.action, b.ids));
      } catch (e) {
        next(e);
      }
    });
  });

  return r;
}

export function publicListingRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get('/', validate({ query: publicListQuery }), async (req, res) => {
    const f = query<{ page: number; pageSize: number; q?: string; category?: string; location?: string; featured?: string; sort: string }>(req);
    const where = [`l.status = 'published'`];
    const p: unknown[] = [];
    if (f.q) {
      p.push(f.q, `%${likeEscape(f.q)}%`);
      where.push(`(l.search_tsv @@ websearch_to_tsquery('english', $${p.length - 1}) or l.name ilike $${p.length} escape '\\')`);
    }
    if (f.category) {
      p.push(f.category);
      where.push(`(c.slug = $${p.length} or c.parent_id = (select id from ${db.t('categories')} where slug = $${p.length})
                  or exists (select 1 from ${db.t('categories')} sc where sc.slug = $${p.length} and sc.id = any(l.secondary_category_ids)))`);
    }
    if (f.location) {
      p.push(f.location);
      where.push(`exists (select 1 from ${db.t('locations')} loc where loc.slug = $${p.length}
                  and loc.id in (l.country_id, l.region_id, l.city_id, l.neighborhood_id))`);
    }
    if (f.featured) {
      p.push(f.featured === 'true');
      where.push(`l.featured = $${p.length}`);
    }
    const order = { name: 'l.name asc', newest: 'l.published_at desc nulls last', featured: 'l.featured desc, l.name asc' }[f.sort];
    const whereSql = where.join(' and ');
    const total = await db.one<{ n: number }>(
      `select count(*)::int as n from ${db.t('listings')} l left join ${db.t('categories')} c on c.id = l.primary_category_id where ${whereSql}`,
      p,
    );
    const rows = await db.many<ListingRow>(
      `${listingSelect(db)} where ${whereSql} order by ${order}, l.id limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
      p,
    );
    res.set('Cache-Control', 'public, max-age=60');
    res.json(paged(rows.map(toPublicListing), total?.n ?? 0, f.page, f.pageSize));
  });

  r.get(
    '/:slug',
    validate({ params: z.strictObject({ slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80) }) }),
    async (req, res) => {
      const row = await db.one<ListingRow>(`${listingSelect(db)} where l.slug = $1 and l.status = 'published'`, [
        params<{ slug: string }>(req).slug,
      ]);
      if (!row) throw notFound('Listing');
      res.set('Cache-Control', 'public, max-age=60');
      res.json(toPublicListing(row));
    },
  );

  return r;
}
