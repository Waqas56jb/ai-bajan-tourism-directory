import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import type { Database, Queryable } from '../database/db.js';
import { buildSet, likeEscape } from '../database/sqlBuilder.js';
import { requirePermission } from '../middleware/auth.js';
import { body, params, query, uuidParam, validate, searchText } from '../middleware/core.js';
import { enqueueSync } from '../sync/syncQueue.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { isSafeHttpUrl, slugify } from '../utils/text.js';

const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');
const terms = z.array(z.string().trim().min(2).max(40)).max(20);
const parentId = z.union([z.uuid(), z.null()]);

// ------------------------------------------------------------------ categories
const categoryFields = {
  name: z.string().trim().min(2).max(80),
  slug: slug.optional(),
  description: z.string().trim().max(500).optional(),
  icon: z.string().trim().max(40).regex(/^[A-Za-z0-9]*$/).optional(),
  image: z.string().trim().max(500).refine((v) => v === '' || isSafeHttpUrl(v), 'Must be an http(s) URL').optional(),
  parentId: parentId.optional(),
  synonyms: terms.optional(),
  order: z.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
};
const CATEGORY_COLUMNS = {
  name: 'name',
  slug: 'slug',
  description: 'description',
  icon: 'icon',
  image: 'image_url',
  parentId: 'parent_id',
  synonyms: 'synonyms',
  order: 'display_order',
  active: 'active',
};

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  image_url: string;
  parent_id: string | null;
  synonyms: string[];
  display_order: number;
  active: boolean;
  listing_count?: number;
  published_count?: number;
  created_at: Date;
  updated_at: Date;
}

const toCategory = (r: CategoryRow) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  icon: r.icon,
  image: r.image_url,
  parentId: r.parent_id,
  synonyms: r.synonyms,
  order: r.display_order,
  active: r.active,
  listingCount: r.listing_count ?? 0,
  publishedCount: r.published_count ?? 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const categorySelect = (db: Database) => `
  select c.*,
    (select count(*)::int from ${db.t('listings')} l where l.primary_category_id = c.id or c.id = any(l.secondary_category_ids)) as listing_count,
    (select count(*)::int from ${db.t('listings')} l where (l.primary_category_id = c.id or c.id = any(l.secondary_category_ids)) and l.status = 'published') as published_count
  from ${db.t('categories')} c`;

/** Category/location names are part of listing chunks — queue those listings for re-indexing. */
async function reindexListingsWhere(q: Queryable, db: Database, whereSql: string, value: string, adminId?: string) {
  const rows = await q.query<{ id: string; content_version: number }>(
    `select id, content_version from ${db.t('listings')} l where ${whereSql} and status = 'published' limit 1000`,
    [value],
  );
  for (const row of rows.rows) {
    await enqueueSync(q, db, { sourceType: 'listing', sourceId: row.id, operation: 'upsert', version: row.content_version, requestedBy: adminId });
  }
  return rows.rowCount ?? 0;
}

export function categoryRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get(
    '/',
    requirePermission('listings:read'),
    validate({ query: z.strictObject({ q: searchText(80).optional(), active: z.enum(['true', 'false']).optional() }) }),
    async (req, res) => {
      const f = query<{ q?: string; active?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.q) {
        p.push(`%${likeEscape(f.q)}%`);
        where.push(`c.name ilike $${p.length} escape '\\'`);
      }
      if (f.active) {
        p.push(f.active === 'true');
        where.push(`c.active = $${p.length}`);
      }
      const rows = await db.many<CategoryRow>(
        `${categorySelect(db)} ${where.length ? `where ${where.join(' and ')}` : ''} order by c.display_order, c.name limit 500`,
        p,
      );
      res.json({ items: rows.map(toCategory) });
    },
  );

  r.get('/:id', requirePermission('listings:read'), validate({ params: uuidParam }), async (req, res) => {
    const row = await db.one<CategoryRow>(`${categorySelect(db)} where c.id = $1`, [params<{ id: string }>(req).id]);
    if (!row) throw notFound('Category');
    res.json(toCategory(row));
  });

  r.post('/', requirePermission('taxonomy:write'), validate({ body: z.strictObject(categoryFields) }), async (req, res) => {
    const b = body<Record<string, unknown> & { name: string; slug?: string }>(req);
    const created = await db.tx(async (client) => {
      const values = { ...b, slug: b.slug ?? slugify(b.name) };
      const { sets, params: p } = buildSet(values, CATEGORY_COLUMNS);
      const cols = sets.map((s) => s.split(' = ')[0]);
      const row = (
        await client.query<CategoryRow>(
          `insert into ${db.t('categories')} (${cols.join(', ')}) values (${p.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
          p,
        )
      ).rows[0];
      await recordAudit(client, db, req, { action: 'category.created', entityType: 'category', entityId: row.id, entityName: row.name });
      return row;
    });
    ctx.lexicon.invalidate();
    res.status(201).json(toCategory(created));
  });

  r.patch(
    '/:id',
    requirePermission('taxonomy:write'),
    validate({ params: uuidParam, body: z.strictObject({ ...categoryFields, name: categoryFields.name.optional() }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<Record<string, unknown>>(req);
      if (b.parentId === id) throw badRequest('A category cannot be its own parent.');
      const updated = await db.tx(async (client) => {
        const before = (await client.query<CategoryRow>(`select * from ${db.t('categories')} where id = $1 for update`, [id])).rows[0];
        if (!before) throw notFound('Category');
        if (b.parentId) {
          const parent = await client.query<{ parent_id: string | null }>(`select parent_id from ${db.t('categories')} where id = $1`, [b.parentId]);
          if (!parent.rowCount) throw badRequest('Parent category does not exist.');
          if (parent.rows[0].parent_id) throw badRequest('Categories can only be nested one level deep.');
        }
        const { sets, params: p } = buildSet(b, CATEGORY_COLUMNS);
        if (!sets.length) throw badRequest('No changes supplied.');
        p.push(id);
        const row = (await client.query<CategoryRow>(`update ${db.t('categories')} set ${sets.join(', ')} where id = $${p.length} returning *`, p)).rows[0];
        let reindexed = 0;
        if (row.name !== before.name || JSON.stringify(row.synonyms) !== JSON.stringify(before.synonyms)) {
          reindexed = await reindexListingsWhere(client, db, `(l.primary_category_id = $1 or $1 = any(l.secondary_category_ids))`, id, req.admin?.id);
        }
        await recordAudit(client, db, req, {
          action: 'category.updated',
          entityType: 'category',
          entityId: id,
          entityName: row.name,
          summary: reindexed ? `Queued ${reindexed} listing(s) for re-indexing` : '',
        });
        return row;
      });
      ctx.lexicon.invalidate();
      res.json(toCategory(updated));
    },
  );

  r.delete(
    '/:id',
    requirePermission('taxonomy:write'),
    validate({ params: uuidParam, query: z.strictObject({ reassignTo: z.uuid().optional() }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const { reassignTo } = query<{ reassignTo?: string }>(req);
      if (reassignTo === id) throw badRequest('Choose a different category to reassign listings to.');
      await db.tx(async (client) => {
        const row = (await client.query<CategoryRow>(`select * from ${db.t('categories')} where id = $1 for update`, [id])).rows[0];
        if (!row) throw notFound('Category');
        const children = await client.query(`select 1 from ${db.t('categories')} where parent_id = $1 limit 1`, [id]);
        if (children.rowCount) throw conflict('Move or delete the sub-categories first.');
        const used = await client.query<{ n: number }>(`select count(*)::int as n from ${db.t('listings')} where primary_category_id = $1`, [id]);
        if (used.rows[0].n > 0 && !reassignTo) {
          throw conflict(`${used.rows[0].n} listing(s) use this category. Reassign them first.`, { listingCount: used.rows[0].n });
        }
        if (reassignTo) {
          const target = await client.query(`select 1 from ${db.t('categories')} where id = $1`, [reassignTo]);
          if (!target.rowCount) throw badRequest('The category to reassign to does not exist.');
          await reindexListingsWhere(client, db, 'l.primary_category_id = $1', id, req.admin?.id);
          await client.query(`update ${db.t('listings')} set primary_category_id = $2, content_version = content_version + 1 where primary_category_id = $1`, [id, reassignTo]);
        }
        await client.query(`update ${db.t('listings')} set secondary_category_ids = array_remove(secondary_category_ids, $1::uuid) where $1 = any(secondary_category_ids)`, [id]);
        await client.query(`delete from ${db.t('categories')} where id = $1`, [id]);
        await recordAudit(client, db, req, { action: 'category.deleted', entityType: 'category', entityId: id, entityName: row.name });
      });
      ctx.lexicon.invalidate();
      res.status(204).end();
    },
  );

  return r;
}

// ------------------------------------------------------------------ locations
const LOCATION_TYPES = ['country', 'region', 'city', 'neighborhood'] as const;
const locationFields = {
  name: z.string().trim().min(2).max(80),
  slug: slug.optional(),
  type: z.enum(LOCATION_TYPES),
  parentId: parentId.optional(),
  description: z.string().trim().max(1000).optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  aliases: terms.optional(),
  active: z.boolean().optional(),
};
const LOCATION_COLUMNS = {
  name: 'name',
  slug: 'slug',
  type: 'type',
  parentId: 'parent_id',
  description: 'description',
  lat: 'latitude',
  lng: 'longitude',
  aliases: 'aliases',
  active: 'active',
};

interface LocationRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  parent_id: string | null;
  description: string;
  latitude: number | null;
  longitude: number | null;
  aliases: string[];
  active: boolean;
  listing_count?: number;
  child_count?: number;
  created_at: Date;
  updated_at: Date;
}

const toLocation = (r: LocationRow) => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  type: r.type,
  parentId: r.parent_id,
  description: r.description,
  lat: r.latitude,
  lng: r.longitude,
  aliases: r.aliases,
  active: r.active,
  listingCount: r.listing_count ?? 0,
  childCount: r.child_count ?? 0,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const locationSelect = (db: Database) => `
  select x.*,
    (select count(*)::int from ${db.t('listings')} l where x.id in (l.country_id, l.region_id, l.city_id, l.neighborhood_id)) as listing_count,
    (select count(*)::int from ${db.t('locations')} ch where ch.parent_id = x.id) as child_count
  from ${db.t('locations')} x`;

export function locationRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get(
    '/',
    requirePermission('listings:read'),
    validate({ query: z.strictObject({ type: z.enum(LOCATION_TYPES).optional(), q: searchText(80).optional() }) }),
    async (req, res) => {
      const f = query<{ type?: string; q?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.type) {
        p.push(f.type);
        where.push(`x.type = $${p.length}`);
      }
      if (f.q) {
        p.push(`%${likeEscape(f.q)}%`);
        where.push(`x.name ilike $${p.length} escape '\\'`);
      }
      const rows = await db.many<LocationRow>(`${locationSelect(db)} ${where.length ? `where ${where.join(' and ')}` : ''} order by x.name limit 1000`, p);
      res.json({ items: rows.map(toLocation) });
    },
  );

  r.get('/:id', requirePermission('listings:read'), validate({ params: uuidParam }), async (req, res) => {
    const row = await db.one<LocationRow>(`${locationSelect(db)} where x.id = $1`, [params<{ id: string }>(req).id]);
    if (!row) throw notFound('Location');
    res.json(toLocation(row));
  });

  r.post('/', requirePermission('taxonomy:write'), validate({ body: z.strictObject(locationFields) }), async (req, res) => {
    const b = body<Record<string, unknown> & { name: string; slug?: string; type: string; parentId?: string | null }>(req);
    if (b.type !== 'country' && !b.parentId) throw badRequest(`A ${b.type} needs a parent location.`, { field: 'parentId' });
    if (b.type === 'country' && b.parentId) throw badRequest('A country cannot have a parent.', { field: 'parentId' });
    const created = await db.tx(async (client) => {
      const { sets, params: p } = buildSet({ ...b, slug: b.slug ?? slugify(b.name) }, LOCATION_COLUMNS);
      const cols = sets.map((s) => s.split(' = ')[0]);
      const row = (
        await client.query<LocationRow>(
          `insert into ${db.t('locations')} (${cols.join(', ')}) values (${p.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
          p,
        )
      ).rows[0];
      await recordAudit(client, db, req, { action: 'location.created', entityType: 'location', entityId: row.id, entityName: row.name });
      return row;
    });
    ctx.lexicon.invalidate();
    res.status(201).json(toLocation(created));
  });

  r.patch(
    '/:id',
    requirePermission('taxonomy:write'),
    validate({ params: uuidParam, body: z.strictObject({ ...locationFields, name: locationFields.name.optional(), type: locationFields.type.optional() }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<Record<string, unknown>>(req);
      const updated = await db.tx(async (client) => {
        const before = (await client.query<LocationRow>(`select * from ${db.t('locations')} where id = $1 for update`, [id])).rows[0];
        if (!before) throw notFound('Location');
        const { sets, params: p } = buildSet(b, LOCATION_COLUMNS);
        if (!sets.length) throw badRequest('No changes supplied.');
        p.push(id);
        // The hierarchy trigger rejects cycles and invalid parent types (mapped to 400).
        const row = (await client.query<LocationRow>(`update ${db.t('locations')} set ${sets.join(', ')} where id = $${p.length} returning *`, p)).rows[0];
        let reindexed = 0;
        if (row.name !== before.name || JSON.stringify(row.aliases) !== JSON.stringify(before.aliases)) {
          reindexed = await reindexListingsWhere(client, db, '$1 in (l.country_id, l.region_id, l.city_id, l.neighborhood_id)', id, req.admin?.id);
        }
        await recordAudit(client, db, req, {
          action: 'location.updated',
          entityType: 'location',
          entityId: id,
          entityName: row.name,
          summary: reindexed ? `Queued ${reindexed} listing(s) for re-indexing` : '',
        });
        return row;
      });
      ctx.lexicon.invalidate();
      res.json(toLocation(updated));
    },
  );

  r.delete('/:id', requirePermission('taxonomy:write'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    await db.tx(async (client) => {
      const row = (await client.query<LocationRow>(`select * from ${db.t('locations')} where id = $1 for update`, [id])).rows[0];
      if (!row) throw notFound('Location');
      const kids = await client.query(`select 1 from ${db.t('locations')} where parent_id = $1 limit 1`, [id]);
      if (kids.rowCount) throw conflict('This location has child locations. Move or delete them first.');
      const used = await client.query<{ n: number }>(
        `select count(*)::int as n from ${db.t('listings')} where $1 in (country_id, region_id, city_id, neighborhood_id)`,
        [id],
      );
      if (used.rows[0].n) throw conflict(`${used.rows[0].n} listing(s) are in this location. Move them first.`, { listingCount: used.rows[0].n });
      await client.query(`delete from ${db.t('locations')} where id = $1`, [id]);
      await recordAudit(client, db, req, { action: 'location.deleted', entityType: 'location', entityId: id, entityName: row.name });
    });
    ctx.lexicon.invalidate();
    res.status(204).end();
  });

  return r;
}

// ------------------------------------------------------------------ public lookups (active only)
export function publicTaxonomyRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;
  r.get('/categories', async (_req, res) => {
    const rows = await db.many(
      `select id, name, slug, description, icon, image_url as image, parent_id as "parentId", display_order as "order"
         from ${db.t('categories')} where active order by display_order, name limit 500`,
    );
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ items: rows });
  });
  r.get('/locations', async (_req, res) => {
    const rows = await db.many(
      `select id, name, slug, type, parent_id as "parentId", latitude as lat, longitude as lng
         from ${db.t('locations')} where active order by name limit 1000`,
    );
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ items: rows });
  });
  return r;
}
