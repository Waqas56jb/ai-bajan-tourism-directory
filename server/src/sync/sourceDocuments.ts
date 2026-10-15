import type { Database, Queryable } from '../database/db.js';
import { chunkDocument, chunkFaq, packText, type Chunk } from '../indexing/chunker.js';
import { isClassifiedEligible, isDocumentEligible, isFaqEligible, isListingEligible, type SourceType } from './syncQueue.js';

/** Everything the indexer needs to (re)build a source's chunks. */
export interface SourceSnapshot {
  exists: boolean;
  eligible: boolean;
  version: number;
  title: string;
  chunks: Chunk[];
  categoryIds: string[];
  locationIds: string[];
  metadata: Record<string, unknown>;
}

const MISSING: SourceSnapshot = { exists: false, eligible: false, version: 0, title: '', chunks: [], categoryIds: [], locationIds: [], metadata: {} };

async function ancestorsOfLocation(q: Queryable, db: Database, id: string | null): Promise<string[]> {
  if (!id) return [];
  const r = await q.query<{ id: string }>(
    `with recursive up as (select id, parent_id, 0 as d from ${db.t('locations')} where id = $1
       union all select l.id, l.parent_id, up.d + 1 from ${db.t('locations')} l join up on l.id = up.parent_id where up.d < 10)
     select id from up`,
    [id],
  );
  return r.rows.map((x) => x.id);
}

async function categoryWithParent(q: Queryable, db: Database, ids: Array<string | null>) {
  const clean = ids.filter(Boolean) as string[];
  if (!clean.length) return { ids: [] as string[], names: [] as string[] };
  const r = await q.query<{ id: string; name: string; parent_id: string | null; parent_name: string | null; synonyms: string[] }>(
    `select c.id, c.name, c.parent_id, p.name as parent_name, c.synonyms from ${db.t('categories')} c
       left join ${db.t('categories')} p on p.id = c.parent_id where c.id = any($1)`,
    [clean],
  );
  const outIds = new Set<string>();
  const names = new Set<string>();
  for (const row of r.rows) {
    outIds.add(row.id);
    names.add(row.name);
    for (const s of row.synonyms) names.add(s);
    if (row.parent_id) {
      outIds.add(row.parent_id);
      if (row.parent_name) names.add(row.parent_name);
    }
  }
  return { ids: [...outIds], names: [...names] };
}

export async function loadListingSource(q: Queryable, db: Database, id: string): Promise<SourceSnapshot> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw row, fields read below
  const r = await q.query<Record<string, any>>(
    `select l.*, n.name as neighborhood_name, ci.name as city_name, rg.name as region_name, co.name as country_name
       from ${db.t('listings')} l
       left join ${db.t('locations')} n on n.id = l.neighborhood_id
       left join ${db.t('locations')} ci on ci.id = l.city_id
       left join ${db.t('locations')} rg on rg.id = l.region_id
       left join ${db.t('locations')} co on co.id = l.country_id
      where l.id = $1`,
    [id],
  );
  const l = r.rows[0];
  if (!l) return MISSING;
  const cats = await categoryWithParent(q, db, [l.primary_category_id, ...(l.secondary_category_ids ?? [])]);
  const area = [l.neighborhood_name, l.city_name, l.region_name, l.country_name].filter(Boolean).join(', ');
  const header = `${l.name} — ${[cats.names.slice(0, 4).join(', '), area].filter(Boolean).join(' — ')}`;

  const profile = [l.short_description, l.description].filter((s: string) => s?.trim()).join('\n\n');
  const chunks: Chunk[] = packText(profile || l.name, header).map((text) => ({ kind: 'listing_profile', title: l.name, text }));

  // Practical facts stay together in one chunk so "opening hours" or "phone" questions retrieve them whole.
  const facts: string[] = [];
  if (l.listing_type) facts.push(`Type: ${l.listing_type}`);
  if (cats.names.length) facts.push(`Categories: ${cats.names.join(', ')}`);
  if (area) facts.push(`Area: ${area}`);
  if (l.address_display === 'full' && l.street_address) facts.push(`Address: ${l.street_address}`);
  if (l.opening_hours?.length) facts.push(`Opening hours: ${l.opening_hours.map((h: { day: string; hours: string }) => `${h.day}: ${h.hours}`).join('; ')}`);
  if (l.price_range) facts.push(`Price range: ${l.price_range}`);
  if (l.amenities?.length) facts.push(`Amenities: ${l.amenities.join(', ')}`);
  if (l.accessibility) facts.push(`Accessibility: ${l.accessibility}`);
  if (l.languages?.length) facts.push(`Languages spoken: ${l.languages.join(', ')}`);
  if (l.booking_requirements) facts.push(`Booking: ${l.booking_requirements}`);
  if (l.public_notes) facts.push(`Notes: ${l.public_notes}`);
  if (l.verified) facts.push('Verified by AI Bajan: yes');
  if (l.info_confirmed_at) facts.push(`Information last confirmed by the business: ${String(l.info_confirmed_at).slice(0, 10)}`);
  if (l.chatbot_include_contact) {
    if (l.phone) facts.push(`Phone: ${l.phone}`);
    if (l.email) facts.push(`Email: ${l.email}`);
    if (l.website_url) facts.push(`Website: ${l.website_url}`);
    if (l.whatsapp) facts.push(`WhatsApp: ${l.whatsapp}`);
    if (l.booking_url) facts.push(`Booking link: ${l.booking_url}`);
  }
  // private_notes, review feedback and rejection reasons are never included.
  if (facts.length) chunks.push({ kind: 'listing_details', title: l.name, text: `${header}\n${facts.join('\n')}` });

  return {
    exists: true,
    eligible: isListingEligible(l as never),
    version: l.content_version,
    title: l.name,
    chunks,
    categoryIds: cats.ids,
    locationIds: [l.country_id, l.region_id, l.city_id, l.neighborhood_id].filter(Boolean),
    metadata: { slug: l.slug, name: l.name, area, categories: cats.names, url: `/listings/${l.slug}` },
  };
}

export async function loadFaqSource(q: Queryable, db: Database, id: string): Promise<SourceSnapshot> {
  const f = (await q.query<Record<string, any>>(`select * from ${db.t('faqs')} where id = $1`, [id])).rows[0];
  if (!f) return MISSING;
  const cats = await categoryWithParent(q, db, [f.category_id]);
  return {
    exists: true,
    eligible: isFaqEligible(f as never),
    version: f.content_version,
    title: f.question,
    chunks: chunkFaq(f.question, f.answer),
    categoryIds: cats.ids,
    locationIds: await ancestorsOfLocation(q, db, f.location_id),
    metadata: { question: f.question, relatedListingId: f.related_listing_id },
  };
}

/** A Postgres `date` (parsed by node-postgres as local midnight) as YYYY-MM-DD. */
function dateOnly(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  return String(v).slice(0, 10);
}

export async function loadDocumentSource(q: Queryable, db: Database, id: string): Promise<SourceSnapshot> {
  const d = (await q.query<Record<string, any>>(`select * from ${db.t('knowledge_documents')} where id = $1`, [id])).rows[0];
  if (!d) return MISSING;
  const cats = await categoryWithParent(q, db, [d.category_id]);
  const body = [d.summary, d.content].filter((s: string) => s?.trim()).join('\n\n');
  return {
    exists: true,
    eligible: isDocumentEligible(d as never),
    version: d.content_version,
    title: d.title,
    chunks: chunkDocument(d.title, body),
    categoryIds: cats.ids,
    locationIds: await ancestorsOfLocation(q, db, d.location_id),
    metadata: {
      title: d.title,
      sourceType: d.source_type,
      relatedListingId: d.related_listing_id,
      // Original web page for citations (imported or referenced documents only).
      sourceUrl: /^https?:\/\//i.test(d.source_reference ?? '') ? d.source_reference : null,
      // The page's own "last updated" date, kept so answers can say how current a source is.
      sourceUpdatedAt: dateOnly(d.source_updated_at),
    },
  };
}

export async function loadClassifiedSource(q: Queryable, db: Database, id: string): Promise<SourceSnapshot> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw row
  const c = (await q.query<Record<string, any>>(
    `select c.*, l.name as location_name from ${db.t('classifieds')} c left join ${db.t('locations')} l on l.id = c.location_id where c.id = $1`,
    [id],
  )).rows[0];
  if (!c) return MISSING;
  const isJob = c.kind === 'job';
  const where = [c.area, c.location_name].filter(Boolean).join(', ');
  const header = `${isJob ? 'Job vacancy' : 'Classified ad'}: ${c.title}${c.employer ? ` — ${c.employer}` : ''}${where ? ` — ${where}` : ''}`;
  const facts = [
    c.category && `Category: ${c.category}`,
    isJob && c.employment_type && `Type: ${c.employment_type}`,
    isJob && c.salary && `Salary: ${c.salary}`,
    isJob && c.qualifications && `Qualifications: ${c.qualifications}`,
    isJob && c.apply_deadline && `Apply by: ${String(c.apply_deadline).slice(0, 10)}`,
    isJob && c.apply_url && `How to apply: ${c.apply_url}`,
    !isJob && c.price && `Price: ${c.price}`,
    !isJob && c.item_condition && `Condition: ${c.item_condition}`,
    `Contact: ${c.contact_name}`,
    c.contact_phone && `Phone: ${c.contact_phone}`,
    c.contact_whatsapp && `WhatsApp: ${c.contact_whatsapp}`,
    c.contact_email && `Email: ${c.contact_email}`,
    c.expires_at && `Listing expires: ${String(c.expires_at).slice(0, 10)}`,
    `Posted: ${new Date(c.created_at).toISOString().slice(0, 10)}`,
  ].filter(Boolean);
  return {
    exists: true,
    eligible: isClassifiedEligible(c as never),
    version: c.content_version,
    title: c.title,
    chunks: [{ kind: isJob ? 'job' : 'classified', title: c.title, text: [header, c.description, ...facts].join('\n') }],
    categoryIds: [],
    locationIds: await ancestorsOfLocation(q, db, c.location_id),
    metadata: { kind: c.kind, url: `/classifieds?view=${c.id}`, expiresAt: c.expires_at ? String(c.expires_at).slice(0, 10) : null },
  };
}

export function loadSource(q: Queryable, db: Database, type: SourceType, id: string) {
  return type === 'listing'
    ? loadListingSource(q, db, id)
    : type === 'faq'
      ? loadFaqSource(q, db, id)
      : type === 'classified'
        ? loadClassifiedSource(q, db, id)
        : loadDocumentSource(q, db, id);
}

export async function currentVersion(q: Queryable, db: Database, type: SourceType, id: string): Promise<number | null> {
  const table = type === 'listing' ? 'listings' : type === 'faq' ? 'faqs' : type === 'classified' ? 'classifieds' : 'knowledge_documents';
  const r = await q.query<{ v: number }>(`select content_version as v from ${db.t(table)} where id = $1`, [id]);
  return r.rows[0]?.v ?? null;
}
