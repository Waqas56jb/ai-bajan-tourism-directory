/**
 * Reference data seed: Barbados location hierarchy (country → 11 parishes → main towns) and the
 * directory category list used by the admin dashboard. NO businesses are seeded — listings must
 * come from the client's real, approved data so the chatbot never presents invented businesses.
 *
 *   npm run db:seed:reference            (uses DB_SCHEMA from .env)
 *
 * Idempotent: inserts with ON CONFLICT (slug) DO NOTHING, never updates or deletes existing rows.
 */
import { env } from '../../src/config/env.js';
import { createDatabase } from '../../src/database/db.js';

const PARISHES: Array<[string, string, number, number, string[]]> = [
  ['Christ Church', 'christ-church', 13.07, -59.53, ['south coast']],
  ['St. Andrew', 'st-andrew', 13.24, -59.57, ['saint andrew']],
  ['St. George', 'st-george', 13.14, -59.55, ['saint george']],
  ['St. James', 'st-james', 13.19, -59.63, ['saint james', 'west coast', 'platinum coast']],
  ['St. John', 'st-john', 13.17, -59.49, ['saint john']],
  ['St. Joseph', 'st-joseph', 13.2, -59.53, ['saint joseph', 'east coast']],
  ['St. Lucy', 'st-lucy', 13.31, -59.61, ['saint lucy']],
  ['St. Michael', 'st-michael', 13.11, -59.6, ['saint michael']],
  ['St. Peter', 'st-peter', 13.25, -59.62, ['saint peter']],
  ['St. Philip', 'st-philip', 13.11, -59.47, ['saint philip']],
  ['St. Thomas', 'st-thomas', 13.18, -59.59, ['saint thomas']],
];

const TOWNS: Array<[string, string, string, number, number]> = [
  ['Bridgetown', 'bridgetown', 'st-michael', 13.0975, -59.6167],
  ['Holetown', 'holetown', 'st-james', 13.1866, -59.6375],
  ['Speightstown', 'speightstown', 'st-peter', 13.25, -59.6447],
  ['Oistins', 'oistins', 'christ-church', 13.0667, -59.5333],
  ['Bathsheba', 'bathsheba', 'st-joseph', 13.2122, -59.5222],
  ['St. Lawrence Gap', 'st-lawrence-gap', 'christ-church', 13.0697, -59.5639],
];

const CATEGORIES: Array<[string, string, string, string, string[]]> = [
  ['Hotels and Accommodation', 'hotels', 'BedDouble', 'Hotels, villas, apartments and other places to stay.', []],
  ['Restaurants', 'restaurants', 'UtensilsCrossed', 'Restaurants, rum shops, cafés and places to eat.', []],
  ['Cafés and Bakeries', 'cafes', 'Coffee', 'Coffee shops, bakeries and light bites.', []],
  ['Attractions', 'attractions', 'Landmark', 'Landmarks, heritage sites, gardens and things to see.', []],
  ['Beaches', 'beaches', 'Waves', 'Beaches and coastal spots.', []],
  ['Tours and Excursions', 'tours', 'Sailboat', 'Boat trips, island tours and guided experiences.', []],
  ['Transport', 'transport', 'Car', 'Taxis, car rental and airport transfers.', []],
  ['Shopping', 'shopping', 'ShoppingBag', 'Shops, markets and boutiques.', []],
  ['Pharmacies', 'pharmacies', 'Store', 'Pharmacies and chemists.', ['chemist', 'drugstore']],
  ['Health and Wellness', 'health-wellness', 'Flower2', 'Spas, clinics and wellness services.', []],
  ['Events and Nightlife', 'events-nightlife', 'Music', 'Live music, festivals and nightlife.', []],
  ['Local Services', 'local-services', 'Briefcase', 'Banks, supermarkets and everyday services.', []],
];

const db = createDatabase(env().DB_SCHEMA);
try {
  const created = { locations: 0, categories: 0 };
  const ins = async (sql: string, p: unknown[]) => (await db.query(sql, p)).rowCount ?? 0;

  created.locations += await ins(
    `insert into ${db.t('locations')} (name, slug, type, latitude, longitude, description) values ('Barbados', 'barbados', 'country', 13.1939, -59.5432, 'The island of Barbados.') on conflict (slug) do nothing`,
    [],
  );
  const country = (await db.one<{ id: string }>(`select id from ${db.t('locations')} where slug = 'barbados'`))!.id;
  for (const [name, slug, lat, lng, aliases] of PARISHES) {
    created.locations += await ins(
      `insert into ${db.t('locations')} (name, slug, type, parent_id, latitude, longitude, aliases) values ($1,$2,'region',$3,$4,$5,$6) on conflict (slug) do nothing`,
      [name, slug, country, lat, lng, aliases],
    );
  }
  for (const [name, slug, parish, lat, lng] of TOWNS) {
    const parent = await db.one<{ id: string }>(`select id from ${db.t('locations')} where slug = $1`, [parish]);
    if (!parent) continue;
    created.locations += await ins(
      `insert into ${db.t('locations')} (name, slug, type, parent_id, latitude, longitude) values ($1,$2,'city',$3,$4,$5) on conflict (slug) do nothing`,
      [name, slug, parent.id, lat, lng],
    );
  }
  for (const [i, [name, slug, icon, description, synonyms]] of CATEGORIES.entries()) {
    created.categories += await ins(
      `insert into ${db.t('categories')} (name, slug, icon, description, synonyms, display_order) values ($1,$2,$3,$4,$5,$6) on conflict (slug) do nothing`,
      [name, slug, icon, description, synonyms, i + 1],
    );
  }
  const totals = await db.one<{ l: number; c: number }>(`select (select count(*)::int from ${db.t('locations')}) as l, (select count(*)::int from ${db.t('categories')}) as c`);
  console.log(`Inserted ${created.locations} location(s) and ${created.categories} category(ies). Totals now: ${totals!.l} locations, ${totals!.c} categories.`);
} finally {
  await db.close();
}
