import type { Request } from 'express';
import type { PoolClient } from 'pg';
import type { AppContext } from '../app/context.js';
import { changedFields, recordAudit } from '../audit/auditService.js';
import type { Database, Queryable } from '../database/db.js';
import { buildSet, likeEscape } from '../database/sqlBuilder.js';
import { resolveLocationPath } from '../locations/locationPath.js';
import { afterSourceWrite, isListingEligible } from '../sync/syncQueue.js';
import { badRequest, conflict, notFound } from '../utils/errors.js';
import { slugify } from '../utils/text.js';
import {
  flattenListingInput,
  LISTING_COLUMNS,
  LISTING_JSON_COLUMNS,
  toAdminListing,
  type ListingRow,
} from './listingMapper.js';
import type { CreateListingInput, UpdateListingInput } from './listingSchemas.js';

export function listingSelect(db: Database) {
  return `
    select l.*, c.name as category_name, c.slug as category_slug,
           r.name as region_name, ci.name as city_name, n.name as neighborhood_name,
           s.status as index_status, s.last_indexed_at, s.chunk_count
      from ${db.t('listings')} l
      left join ${db.t('categories')} c on c.id = l.primary_category_id
      left join ${db.t('locations')} r on r.id = l.region_id
      left join ${db.t('locations')} ci on ci.id = l.city_id
      left join ${db.t('locations')} n on n.id = l.neighborhood_id
      left join ${db.t('index_state')} s on s.source_type = 'listing' and s.source_id = l.id`;
}

export async function getListingRow(q: Queryable, db: Database, id: string, lock = false): Promise<ListingRow> {
  const r = await q.query<ListingRow>(
    lock ? `select * from ${db.t('listings')} where id = $1 for update` : `${listingSelect(db)} where l.id = $1`,
    [id],
  );
  if (!r.rowCount) throw notFound('Listing');
  return r.rows[0];
}

async function uniqueSlug(q: Queryable, db: Database, base: string, excludeId?: string) {
  const root = slugify(base) || 'listing';
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root.slice(0, 75)}-${i + 1}`;
    const r = await q.query(`select 1 from ${db.t('listings')} where slug = $1 and ($2::uuid is null or id <> $2)`, [
      candidate,
      excludeId ?? null,
    ]);
    if (!r.rowCount) return candidate;
  }
  throw conflict('Could not generate a unique slug. Please choose one.');
}

export async function isSlugAvailable(db: Database, slug: string, excludeId?: string) {
  const r = await db.query(`select 1 from ${db.t('listings')} where slug = $1 and ($2::uuid is null or id <> $2)`, [
    slug,
    excludeId ?? null,
  ]);
  return { available: !r.rowCount, suggestion: r.rowCount ? await uniqueSlug(db, db, slug, excludeId) : slug };
}

async function saveRevision(q: Queryable, db: Database, row: ListingRow, adminId?: string) {
  await q.query(
    `insert into ${db.t('content_revisions')} (entity_type, entity_id, version, snapshot, created_by)
     values ('listing', $1, $2, $3, $4) on conflict do nothing`,
    [row.id, row.content_version, JSON.stringify(toAdminListing(row)), adminId ?? null],
  );
}

export interface ListFilters {
  page: number;
  pageSize: number;
  q?: string;
  status?: string[];
  categoryId?: string;
  locationId?: string;
  featured?: 'true' | 'false';
  includeInChatbot?: 'true' | 'false';
  sort: 'name' | 'updatedAt' | 'createdAt' | 'status';
  dir: 'asc' | 'desc';
}

export async function listListings(db: Database, f: ListFilters) {
  const where: string[] = [];
  const p: unknown[] = [];
  const add = (sql: string, ...values: unknown[]) => {
    let s = sql;
    for (const v of values) {
      p.push(v);
      s = s.replace('?', `$${p.length}`);
    }
    where.push(s);
  };
  if (f.q) add(`(l.search_tsv @@ websearch_to_tsquery('english', ?) or l.name ilike ? escape '\\')`, f.q, `%${likeEscape(f.q)}%`);
  if (f.status?.length) add(`l.status = any(?)`, f.status);
  if (f.categoryId)
    add(
      `(l.primary_category_id = ? or ? = any(l.secondary_category_ids) or l.primary_category_id in (select id from ${db.t('categories')} where parent_id = ?))`,
      f.categoryId,
      f.categoryId,
      f.categoryId,
    );
  if (f.locationId) add(`? in (l.country_id, l.region_id, l.city_id, l.neighborhood_id)`, f.locationId);
  if (f.featured) add(`l.featured = ?`, f.featured === 'true');
  if (f.includeInChatbot) add(`l.include_in_chatbot = ?`, f.includeInChatbot === 'true');
  const whereSql = where.length ? `where ${where.join(' and ')}` : '';
  const sortCol = { name: 'l.name', updatedAt: 'l.updated_at', createdAt: 'l.created_at', status: 'l.status' }[f.sort];
  const total = await db.one<{ n: number }>(`select count(*)::int as n from ${db.t('listings')} l ${whereSql}`, p);
  const rows = await db.many<ListingRow>(
    `${listingSelect(db)} ${whereSql} order by ${sortCol} ${f.dir === 'asc' ? 'asc' : 'desc'}, l.id limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
    p,
  );
  return { rows, total: total?.n ?? 0 };
}

export async function createListing(ctx: AppContext, req: Request, input: CreateListingInput) {
  const { db } = ctx;
  return db.tx(async (client) => {
    const flat = flattenListingInput(input);
    Object.assign(flat, await resolveLocationPath(client, db, input.location ?? {}));
    flat.slug = input.slug ? input.slug : await uniqueSlug(client, db, input.name);
    if (input.slug) {
      const taken = await client.query(`select 1 from ${db.t('listings')} where slug = $1`, [input.slug]);
      if (taken.rowCount) throw conflict('That slug is already used by another listing.', { field: 'slug' });
    }
    const { sets, params } = buildSet(flat, LISTING_COLUMNS, 1, LISTING_JSON_COLUMNS);
    const cols = sets.map((s) => s.split(' = ')[0]);
    params.push(req.admin?.id ?? null, req.admin?.id ?? null);
    const r = await client.query<{ id: string }>(
      `insert into ${db.t('listings')} (${[...cols, 'created_by', 'updated_by'].join(', ')})
       values (${params.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
      params,
    );
    const id = r.rows[0].id;
    const row = await getListingRow(client, db, id);
    await afterSourceWrite(client, db, {
      sourceType: 'listing',
      sourceId: id,
      version: row.content_version,
      eligible: isListingEligible(row),
      requestedBy: req.admin?.id,
    });
    await recordAudit(client, db, req, {
      action: 'listing.created',
      entityType: 'listing',
      entityId: id,
      entityName: row.name,
      summary: `Created listing (${row.status})`,
    });
    return toAdminListing(row);
  });
}

export async function updateListing(ctx: AppContext, req: Request, id: string, input: UpdateListingInput) {
  const { db } = ctx;
  return db.tx(async (client) => {
    const current = await getListingRow(client, db, id, true);
    if (input.expectedVersion && input.expectedVersion !== current.content_version) {
      throw conflict('This listing was changed by someone else. Reload it and apply your changes again.', {
        currentVersion: current.content_version,
      });
    }
    const flat = flattenListingInput(input, current);
    if (input.location && ['countryId', 'regionId', 'cityId', 'neighborhoodId'].some((k) => k in input.location!)) {
      Object.assign(flat, await resolveLocationPath(client, db, input.location));
    }
    if (input.slug && input.slug !== current.slug) {
      const taken = await client.query(`select 1 from ${db.t('listings')} where slug = $1 and id <> $2`, [input.slug, id]);
      if (taken.rowCount) throw conflict('That slug is already used by another listing.', { field: 'slug' });
    }
    const { sets, params } = buildSet(flat, LISTING_COLUMNS, 1, LISTING_JSON_COLUMNS);
    if (!sets.length) throw badRequest('No changes supplied.');
    await saveRevision(client, db, current, req.admin?.id);
    params.push(req.admin?.id ?? null, id);
    await client.query(
      `update ${db.t('listings')} set ${sets.join(', ')}, updated_by = $${params.length - 1},
              content_version = content_version + 1 where id = $${params.length}`,
      params,
    );
    const row = await getListingRow(client, db, id);
    await afterSourceWrite(client, db, {
      sourceType: 'listing',
      sourceId: id,
      version: row.content_version,
      eligible: isListingEligible(row),
      requestedBy: req.admin?.id,
    });
    const before = toAdminListing(current) as unknown as Record<string, unknown>;
    const after = toAdminListing(row) as unknown as Record<string, unknown>;
    await recordAudit(client, db, req, {
      action: 'listing.updated',
      entityType: 'listing',
      entityId: id,
      entityName: row.name,
      summary: 'Updated listing',
      changes: { fields: changedFields(before, after).filter((k) => !['updatedAt', 'version', 'ai'].includes(k)) },
    });
    return toAdminListing(row);
  });
}

async function applyStatus(
  client: PoolClient,
  db: Database,
  req: Request,
  id: string,
  status: string,
  meta: { reason?: string; feedback?: string } = {},
) {
  const current = await getListingRow(client, db, id, true);
  await client.query(
    `update ${db.t('listings')} set status = $2,
            published_at = case when $2 = 'published' then coalesce(published_at, now()) else published_at end,
            archived_at = case when $2 = 'archived' then now() when $2 = 'published' then null else archived_at end,
            rejection_reason = case when $2 = 'rejected' then $3 when $2 = 'published' then '' else rejection_reason end,
            review_feedback = case when $2 in ('rejected','pending','draft') and $4 <> '' then $4 else review_feedback end,
            updated_by = $5, content_version = content_version + 1
      where id = $1`,
    [id, status, meta.reason ?? '', meta.feedback ?? '', req.admin?.id ?? null],
  );
  const row = await getListingRow(client, db, id);
  await afterSourceWrite(client, db, {
    sourceType: 'listing',
    sourceId: id,
    version: row.content_version,
    eligible: isListingEligible(row),
    requestedBy: req.admin?.id,
  });
  await recordAudit(client, db, req, {
    action: `listing.${status}`,
    entityType: 'listing',
    entityId: id,
    entityName: row.name,
    summary: `Status ${current.status} → ${status}${meta.reason ? ` (${meta.reason.slice(0, 120)})` : ''}`,
  });
  return row;
}

export async function setListingStatus(ctx: AppContext, req: Request, id: string, status: string, meta: { reason?: string; feedback?: string }) {
  const row = await ctx.db.tx((client) => applyStatus(client, ctx.db, req, id, status, meta));
  return toAdminListing(row);
}

export async function setListingFeatured(ctx: AppContext, req: Request, id: string, featured: boolean) {
  const { db } = ctx;
  return db.tx(async (client) => {
    await getListingRow(client, db, id, true);
    await client.query(`update ${db.t('listings')} set featured = $2, updated_by = $3 where id = $1`, [id, featured, req.admin?.id ?? null]);
    const row = await getListingRow(client, db, id);
    await recordAudit(client, db, req, {
      action: featured ? 'listing.featured' : 'listing.unfeatured',
      entityType: 'listing',
      entityId: id,
      entityName: row.name,
    });
    return toAdminListing(row);
  });
}

async function deleteOne(client: PoolClient, db: Database, req: Request, id: string) {
  const current = await getListingRow(client, db, id, true);
  await client.query(`delete from ${db.t('listings')} where id = $1`, [id]);
  await afterSourceWrite(client, db, {
    sourceType: 'listing',
    sourceId: id,
    version: current.content_version + 1,
    eligible: false,
    deleted: true,
    requestedBy: req.admin?.id,
  });
  await recordAudit(client, db, req, { action: 'listing.deleted', entityType: 'listing', entityId: id, entityName: current.name });
}

export async function deleteListing(ctx: AppContext, req: Request, id: string) {
  await ctx.db.tx((client) => deleteOne(client, ctx.db, req, id));
}

/** Bulk actions run in one transaction: either every listing changes or none does. */
export async function bulkListings(ctx: AppContext, req: Request, action: string, ids: string[]) {
  const { db } = ctx;
  const unique = [...new Set(ids)];
  return db.tx(async (client) => {
    for (const id of unique) {
      if (action === 'delete') await deleteOne(client, db, req, id);
      else if (action === 'feature' || action === 'unfeature') {
        await getListingRow(client, db, id, true);
        await client.query(`update ${db.t('listings')} set featured = $2 where id = $1`, [id, action === 'feature']);
      } else {
        const status = { publish: 'published', archive: 'archived', draft: 'draft' }[action]!;
        await applyStatus(client, db, req, id, status);
      }
    }
    return { action, affected: unique.length };
  });
}

export async function listingRevisions(db: Database, id: string) {
  return db.many(
    `select version, created_at as "createdAt", created_by as "createdBy" from ${db.t('content_revisions')}
      where entity_type = 'listing' and entity_id = $1 order by version desc limit 50`,
    [id],
  );
}
