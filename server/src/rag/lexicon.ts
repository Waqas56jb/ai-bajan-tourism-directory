import type { Database } from '../database/db.js';

/**
 * Curated synonym groups. A category whose name/slug/synonyms contain any term of a group gets
 * the whole group. Keep these conservative: they decide category detection, so an over-broad
 * group would silently attach the wrong filter. Product terms (e.g. "test strips") are NOT
 * expanded here on purpose.
 */
export const SYNONYM_GROUPS: string[][] = [
  ['pharmacy', 'pharmacies', 'chemist', 'chemists', 'drugstore', 'drugstores', 'drug store', 'drug stores', 'apothecary'],
  ['hotel', 'hotels', 'resort', 'resorts', 'accommodation', 'accommodations', 'lodging', 'place to stay', 'places to stay', 'where to stay'],
  ['guesthouse', 'guesthouses', 'guest house', 'guest houses', 'b&b', 'bed and breakfast'],
  ['villa', 'villas', 'holiday rental', 'holiday rentals', 'vacation rental', 'vacation rentals'],
  ['restaurant', 'restaurants', 'eatery', 'eateries', 'place to eat', 'places to eat', 'where to eat', 'dining'],
  ['cafe', 'cafes', 'café', 'cafés', 'coffee shop', 'coffee shops', 'bakery', 'bakeries'],
  ['bar', 'bars', 'rum shop', 'rum shops', 'pub', 'pubs', 'nightlife'],
  ['beach', 'beaches'],
  ['tour', 'tours', 'excursion', 'excursions', 'boat trip', 'boat trips', 'cruise', 'cruises', 'catamaran'],
  ['attraction', 'attractions', 'sightseeing', 'things to do', 'activities', 'activity', 'experiences', 'experience', 'landmarks', 'heritage site', 'heritage sites', 'what to do', 'what can i do', 'what is there to do', 'whats there to do'],
  ['taxi', 'taxis', 'car rental', 'car rentals', 'car hire', 'transport', 'transportation', 'airport transfer', 'airport transfers'],
  ['shop', 'shops', 'shopping', 'store', 'stores', 'boutique', 'boutiques', 'market', 'markets'],
  ['spa', 'spas', 'wellness', 'massage'],
  ['doctor', 'doctors', 'clinic', 'clinics', 'medical centre', 'medical center', 'hospital', 'hospitals'],
  ['supermarket', 'supermarkets', 'grocery', 'groceries', 'grocery store', 'grocery stores'],
  ['bank', 'banks', 'atm', 'atms', 'currency exchange'],
];

/** Words in category names that carry no meaning on their own ("Hotels and Accommodation"). */
const GENERIC_NAME_WORDS = new Set(['and', 'the', 'of', 'other', 'general', 'services', 'service', 'places', 'local', 'things', '&', 'misc', 'more']);

export interface CategoryEntry {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  terms: string[];
}

export interface LocationEntry {
  id: string;
  slug: string;
  name: string;
  type: string;
  parentId: string | null;
  terms: string[];
}

export interface Lexicon {
  categories: CategoryEntry[];
  locations: LocationEntry[];
  listingNames: Array<{ id: string; name: string; slug: string }>;
  loadedAt: number;
}

export const singular = (w: string) =>
  w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && /(ches|shes|xes|sses)$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;

function categoryTerms(name: string, slug: string, synonyms: string[]): string[] {
  const terms = new Set<string>();
  const lowerName = name.toLowerCase();
  terms.add(lowerName);
  for (const part of lowerName.split(/[^a-z0-9&]+/)) {
    if (part.length > 2 && !GENERIC_NAME_WORDS.has(part)) {
      terms.add(part);
      terms.add(singular(part));
    }
  }
  for (const part of slug.split('-')) if (part.length > 2 && !GENERIC_NAME_WORDS.has(part)) terms.add(part);
  for (const s of synonyms) terms.add(s.toLowerCase());
  for (const group of SYNONYM_GROUPS) {
    if (group.some((g) => terms.has(g))) for (const g of group) terms.add(g);
  }
  return [...terms].filter((t) => t.length > 1);
}

export function buildLexicon(
  categories: Array<{ id: string; slug: string; name: string; parent_id: string | null; synonyms: string[] }>,
  locations: Array<{ id: string; slug: string; name: string; type: string; parent_id: string | null; aliases: string[] }>,
  listings: Array<{ id: string; name: string; slug: string }> = [],
): Lexicon {
  return {
    categories: categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, parentId: c.parent_id, terms: categoryTerms(c.name, c.slug, c.synonyms ?? []) })),
    locations: locations.map((l) => ({
      id: l.id,
      slug: l.slug,
      name: l.name,
      type: l.type,
      parentId: l.parent_id,
      terms: [...new Set([l.name.toLowerCase(), l.slug.replace(/-/g, ' '), ...(l.aliases ?? []).map((a) => a.toLowerCase())])].filter((t) => t.length > 2),
    })),
    listingNames: listings,
    loadedAt: Date.now(),
  };
}

/** Lexicon cache: reloaded at most every `ttlMs`, and immediately after taxonomy edits. */
export class LexiconCache {
  private value: Lexicon | null = null;
  private loading: Promise<Lexicon> | null = null;

  constructor(
    private readonly db: Database,
    private readonly ttlMs = 60_000,
  ) {}

  invalidate() {
    this.value = null;
  }

  async get(): Promise<Lexicon> {
    if (this.value && Date.now() - this.value.loadedAt < this.ttlMs) return this.value;
    this.loading ??= (async () => {
      try {
        const [cats, locs, listings] = await Promise.all([
          this.db.many(`select id, slug, name, parent_id, synonyms from ${this.db.t('categories')} where active`),
          this.db.many(`select id, slug, name, type, parent_id, aliases from ${this.db.t('locations')} where active`),
          // Names of chatbot-eligible listings, for "what time does <name> open?" detection.
          this.db.many(`select id, name, slug from ${this.db.t('listings')} where status = 'published' and include_in_chatbot limit 5000`),
        ]);
        this.value = buildLexicon(cats as never, locs as never, listings as never);
        return this.value;
      } finally {
        this.loading = null;
      }
    })();
    return this.loading;
  }
}
