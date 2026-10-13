import type { Database, Queryable } from '../database/db.js';
import { badRequest } from '../utils/errors.js';

export interface LocationPathInput {
  countryId?: string | null;
  regionId?: string | null;
  cityId?: string | null;
  neighborhoodId?: string | null;
}

const LEVELS = ['country', 'region', 'city', 'neighborhood'] as const;
const FIELD = { country: 'countryId', region: 'regionId', city: 'cityId', neighborhood: 'neighborhoodId' } as const;

/**
 * Resolve a listing's location path from the deepest id supplied and verify that every id the
 * client sent is consistent with that path (e.g. the city really is inside the region).
 */
export async function resolveLocationPath(q: Queryable, db: Database, input: LocationPathInput) {
  const deepest = [...LEVELS].reverse().find((lvl) => input[FIELD[lvl]]);
  const empty = { countryId: null, regionId: null, cityId: null, neighborhoodId: null } as Record<string, string | null>;
  if (!deepest) return empty;
  const r = await q.query<{ id: string; type: string; depth: number }>(
    `with recursive path as (
       select id, type, parent_id, 0 as depth from ${db.t('locations')} where id = $1
       union all
       select l.id, l.type, l.parent_id, p.depth + 1 from ${db.t('locations')} l join path p on l.id = p.parent_id
        where p.depth < 10
     ) select id, type, depth from path`,
    [input[FIELD[deepest]]],
  );
  if (!r.rowCount) throw badRequest('The selected location does not exist.', { field: `location.${FIELD[deepest]}` });
  const resolved = { ...empty };
  for (const row of r.rows) resolved[FIELD[row.type as (typeof LEVELS)[number]]] = row.id;
  if (r.rows.find((row) => row.depth === 0)?.type !== deepest) {
    throw badRequest(`The location supplied as ${FIELD[deepest]} is not a ${deepest}.`, { field: `location.${FIELD[deepest]}` });
  }
  for (const lvl of LEVELS) {
    const given = input[FIELD[lvl]];
    if (given && given !== resolved[FIELD[lvl]]) {
      throw badRequest(`location.${FIELD[lvl]} does not match the selected ${deepest}.`, { field: `location.${FIELD[lvl]}` });
    }
  }
  return resolved;
}

/** All descendant ids of a location (inclusive) — used for "in this area" filters. */
export async function locationWithDescendants(q: Queryable, db: Database, id: string): Promise<string[]> {
  const r = await q.query<{ id: string }>(
    `with recursive tree as (
       select id, 0 as depth from ${db.t('locations')} where id = $1
       union all
       select l.id, t.depth + 1 from ${db.t('locations')} l join tree t on l.parent_id = t.id where t.depth < 10
     ) select id from tree`,
    [id],
  );
  return r.rows.map((x) => x.id);
}
