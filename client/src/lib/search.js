/**
 * Directory search: pure, deterministic functions shared by the mock API adapter and the demo
 * chat adapter. The future backend should implement the same semantics server-side.
 *
 * Relevance rules
 *  - Structured filters (category, location, type, amenities, featured) are exact matches on
 *    record fields — never free-text guesses.
 *  - Place names typed into the search box ("restaurants in holetown") are recognised as
 *    location constraints, not loose keywords.
 *  - Every remaining meaningful word must match (AND). Generic filler words are ignored, so a
 *    broad word can't make every listing match.
 *  - Category words match a business only through its own categories' *generic* names
 *    ("restaurant", "stays"). Specific words ("snorkelling", "seafood") must appear in the
 *    business's own name, type, keywords or description.
 */
import { categories, categoryBySlug } from '@/data/categories';
import { areas, parishAliases } from '@/data/destinations';
import { amenities as amenityVocabulary } from '@/data/amenities';

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'featured', label: 'Featured first' },
];

export const DEFAULT_PAGE_SIZE = 12;

const STOPWORDS = new Set(
  `a an and any are around at be best by can close could do does find for from get give good
  have i in into is it list listed listing listings looking me my near nearby of on or our please
  show some something the there these this to want we what where which who with you your all
  options businesses business places place spot spots recommend recommendation any tell about
  information info available barbados bajan offer offers offering provide provides service
  services has sell sells serve serves include includes included explore visit visiting go going
  new great nice top popular recommended local kind type types ones one more other
  experience experiences directory provider providers company companies operator operators start
  starts starting depart departs leave leaves`
    .split(/\s+/)
    .filter(Boolean),
);

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Very light English stemming so "guesthouses" ≈ "guesthouse", "tours" ≈ "tour". */
export function stem(token) {
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (/(ches|shes|xes|sses)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith('ing') && token.length > 6) {
    const base = token.slice(0, -3);
    return base.endsWith('ll') ? base.slice(0, -1) : base; // snorkelling → snorkel
  }
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function tokens(value) {
  const n = normalize(value);
  return n ? n.split(' ') : [];
}

function meaningfulTokens(value) {
  return tokens(value)
    .filter((t) => !STOPWORDS.has(t) && t.length > 1)
    .map(stem);
}

/* ------------------------------------------------------------------ */
/* Locations                                                          */
/* ------------------------------------------------------------------ */

const coastAliases = {
  'west coast': 'West Coast',
  'platinum coast': 'West Coast',
  'south coast': 'South Coast',
  'east coast': 'East Coast',
  'atlantic coast': 'East Coast',
};

/** Alias phrases sorted longest-first so "st lawrence gap" wins over "gap". */
const locationPhrases = [
  ...areas.flatMap((a) =>
    [a.name, ...a.aliases].map((alias) => ({ phrase: normalize(alias), area: a.name })),
  ),
  ...Object.entries(parishAliases).map(([alias, parish]) => ({ phrase: normalize(alias), parish })),
  ...Object.entries(coastAliases).map(([alias, coast]) => ({ phrase: normalize(alias), coast })),
].sort((x, y) => y.phrase.length - x.phrase.length);

function removePhrase(text, phrase) {
  return ` ${text} `.replace(` ${phrase} `, ' ').trim();
}

/** Pull the first recognised location phrase out of free text. */
export function extractLocation(text) {
  let rest = normalize(text);
  for (const entry of locationPhrases) {
    if (` ${rest} `.includes(` ${entry.phrase} `)) {
      rest = removePhrase(rest, entry.phrase);
      const { phrase: _p, ...location } = entry;
      return { location, rest };
    }
  }
  return { location: null, rest };
}

export function matchesLocation(business, location) {
  if (!location) return true;
  if (typeof location === 'string')
    return business.area === location || business.parish === location;
  if (location.area) return business.area === location.area;
  if (location.parish) return business.parish === location.parish;
  if (location.coast) {
    const area = areas.find((a) => a.name === business.area);
    return area?.coast === location.coast;
  }
  return true;
}

export function describeLocation(location) {
  if (!location) return '';
  if (typeof location === 'string') return location;
  return location.area ?? location.parish ?? location.coast ?? '';
}

/* ------------------------------------------------------------------ */
/* Categories                                                         */
/* ------------------------------------------------------------------ */

/** Words that only express "this category" — they never narrow results further. */
const GENERIC_CATEGORY_WORDS = {
  restaurants: [
    'restaurant',
    'restaurants',
    'dining',
    'dine',
    'eat',
    'eating',
    'food',
    'lunch',
    'dinner',
    'cuisine',
  ],
  hotels: [
    'hotel',
    'hotels',
    'stay',
    'stays',
    'staying',
    'accommodation',
    'accommodations',
    'lodging',
    'sleep',
    'room',
    'rooms',
  ],
  tours: [
    'tour',
    'tours',
    'adventure',
    'adventures',
    'activity',
    'activities',
    'excursion',
    'excursions',
    'thing to do',
    'things to do',
  ],
  attractions: ['attraction', 'attractions', 'sightseeing', 'sights'],
  shopping: ['shop', 'shops', 'shopping', 'store', 'stores'],
  transportation: ['transport', 'transportation', 'getting around'],
  culture: ['culture', 'cultural', 'heritage'],
  wellness: ['wellness', 'relax', 'relaxation'],
};

const genericCategoryTokens = Object.fromEntries(
  Object.entries(GENERIC_CATEGORY_WORDS).map(([slug, words]) => {
    const c = categoryBySlug[slug];
    const all = [...words, slug, c.shortName, c.singular, ...tokens(c.name)];
    return [slug, new Set(all.flatMap((w) => meaningfulTokens(w)))];
  }),
);

const ALL_GENERIC_TOKENS = new Set(Object.values(genericCategoryTokens).flatMap((s) => [...s]));

/** Detect categories mentioned in free text (synonyms included). */
export function detectCategories(text) {
  const norm = ` ${normalize(text)} `;
  const stemmed = new Set(meaningfulTokens(text));
  const found = [];
  for (const c of categories) {
    const hit = c.synonyms.some((syn) => {
      const n = normalize(syn);
      return n.includes(' ') ? norm.includes(` ${n} `) : stemmed.has(stem(n));
    });
    if (hit) found.push(c.slug);
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Amenities                                                          */
/* ------------------------------------------------------------------ */

const amenityPhrases = [
  ['family friendly', 'family-friendly'],
  ['family', 'family-friendly'],
  ['kids', 'family-friendly'],
  ['children', 'family-friendly'],
  ['wheelchair', 'wheelchair-accessible'],
  ['accessible', 'wheelchair-accessible'],
  ['beachfront', 'beachfront'],
  ['on the beach', 'beachfront'],
  ['ocean view', 'ocean-view'],
  ['sea view', 'ocean-view'],
  ['vegetarian', 'vegetarian-options'],
  ['vegan', 'vegetarian-options'],
  ['pool', 'pool'],
  ['wifi', 'free-wifi'],
  ['wi fi', 'free-wifi'],
  ['parking', 'parking'],
  ['airport transfer', 'airport-transfers'],
  ['self catering', 'kitchen'],
  ['beginner', 'beginner-friendly'],
  ['beginners', 'beginner-friendly'],
  ['private group', 'private-groups'],
].map(([phrase, key]) => [normalize(phrase), key]);

export function detectAmenities(text) {
  const norm = ` ${normalize(text)} `;
  return [
    ...new Set(amenityPhrases.filter(([p]) => norm.includes(` ${p} `)).map(([, key]) => key)),
  ];
}

/* ------------------------------------------------------------------ */
/* Business index & matching                                          */
/* ------------------------------------------------------------------ */

const FIELD_WEIGHTS = {
  name: 8,
  type: 6,
  keywords: 5,
  category: 4,
  location: 4,
  amenities: 2,
  description: 1,
};
const indexCache = new WeakMap();

function buildIndex(business) {
  const area = areas.find((a) => a.name === business.area);
  const fieldTokens = {
    name: meaningfulTokens(business.name),
    type: meaningfulTokens(business.businessType),
    keywords: (business.keywords ?? []).flatMap((k) => meaningfulTokens(k)),
    category: (business.categories ?? [business.category]).flatMap((slug) => [
      ...(genericCategoryTokens[slug] ?? []),
    ]),
    location: meaningfulTokens(
      [business.area, business.parish, area?.coast, ...(area?.aliases ?? [])].join(' '),
    ),
    amenities: (business.amenities ?? []).flatMap((a) =>
      meaningfulTokens(amenityVocabulary[a]?.label ?? a),
    ),
    description: meaningfulTokens(
      `${business.shortDescription ?? ''} ${business.description ?? ''} ${(business.highlights ?? []).join(' ')}`,
    ),
  };
  return {
    fields: Object.fromEntries(Object.entries(fieldTokens).map(([k, v]) => [k, new Set(v)])),
    nameNorm: normalize(business.name),
  };
}

function getIndex(business) {
  let idx = indexCache.get(business);
  if (!idx) {
    idx = buildIndex(business);
    indexCache.set(business, idx);
  }
  return idx;
}

/**
 * Generic category words ("restaurants", "hotel", "shop") only match through a listing's
 * category — never through prose. Otherwise a boutique whose description mentions "nearby
 * restaurants" would appear in a restaurant search.
 */
const CATEGORY_WORD_FIELDS = new Set(['category', 'type', 'name']);

function tokenScore(token, index) {
  let best = 0;
  const genericOnly = ALL_GENERIC_TOKENS.has(token);
  for (const [field, set] of Object.entries(index.fields)) {
    if (genericOnly && !CATEGORY_WORD_FIELDS.has(field)) continue;
    const weight = FIELD_WEIGHTS[field];
    if (weight <= best) continue;
    if (set.has(token)) {
      best = weight;
      continue;
    }
    // Prefix matching for partially typed words ("resta" → "restaurant"), but never in the
    // category field, which would make short prefixes match whole categories.
    if (token.length >= 4 && field !== 'category') {
      for (const t of set) {
        if (t.startsWith(token)) {
          best = weight * 0.75;
          break;
        }
      }
    }
  }
  return best;
}

/**
 * Score a business against free text. Returns 0 when any meaningful token fails to match.
 * @param {object} business
 * @param {string[]} queryTokens stemmed, stopword-free tokens
 * @param {string} [rawQuery]
 */
export function scoreBusiness(business, queryTokens, rawQuery = '') {
  if (!queryTokens.length) return 1;
  const index = getIndex(business);
  let total = 0;
  for (const token of queryTokens) {
    const s = tokenScore(token, index);
    if (s === 0) return 0;
    total += s;
  }
  const phrase = normalize(rawQuery);
  if (phrase && index.nameNorm.includes(phrase)) total += 20;
  return total;
}

/**
 * Turn a free-text query into structured intent: location, categories, amenities and the
 * leftover keyword tokens. Used by the directory (location only) and the chat adapter (all).
 */
export function interpretQuery(text) {
  const { location, rest } = extractLocation(text);
  const detected = detectCategories(rest);
  const amenityKeys = detectAmenities(rest);
  const amenityWords = new Set(amenityPhrases.flatMap(([p]) => p.split(' ').map(stem)));
  const keywordTokens = meaningfulTokens(rest).filter(
    (t) => !ALL_GENERIC_TOKENS.has(t) && !amenityWords.has(t),
  );
  return { location, categories: detected, amenities: amenityKeys, keywordTokens, rest };
}

/* ------------------------------------------------------------------ */
/* Filtering, facets, sorting, pagination                             */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} DirectoryFilters
 * @property {string} [q]
 * @property {string} [category]  category slug
 * @property {string} [location]  area or parish name
 * @property {string} [type]      businessType
 * @property {string[]} [amenities]
 * @property {boolean} [featured]
 * @property {string} [sort]
 * @property {number} [page]
 * @property {number} [pageSize]
 */

function prepareQuery(q) {
  if (!q || !q.trim()) return { tokens: [], location: null, raw: '' };
  const { location, rest } = extractLocation(q);
  return { tokens: meaningfulTokens(rest), location, raw: rest };
}

function passes(business, filters, query, skip) {
  if (business.status && business.status !== 'published') return false;
  if (
    skip !== 'category' &&
    filters.category &&
    !(business.categories ?? [business.category]).includes(filters.category)
  )
    return false;
  if (skip !== 'location' && filters.location && !matchesLocation(business, filters.location))
    return false;
  if (skip !== 'type' && filters.type && business.businessType !== filters.type) return false;
  if (
    skip !== 'amenities' &&
    filters.amenities?.length &&
    !filters.amenities.every((a) => business.amenities?.includes(a))
  )
    return false;
  if (skip !== 'featured' && filters.featured && !business.isFeatured) return false;
  if (query.location && !matchesLocation(business, query.location)) return false;
  return true;
}

function countBy(list, getKeys) {
  const counts = {};
  for (const item of list) for (const key of getKeys(item)) counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}

export function sortBusinesses(list, sort = 'relevance', scores = new Map()) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const sorted = [...list];
  switch (sort) {
    case 'name-asc':
      return sorted.sort(byName);
    case 'name-desc':
      return sorted.sort((a, b) => byName(b, a));
    case 'featured':
      return sorted.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || byName(a, b));
    case 'relevance':
    default:
      return sorted.sort(
        (a, b) =>
          (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) ||
          Number(b.isFeatured) - Number(a.isFeatured) ||
          byName(a, b),
      );
  }
}

export function paginate(list, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(list.length / pageSize));
  const current = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const start = (current - 1) * pageSize;
  return { items: list.slice(start, start + pageSize), page: current, pageCount, pageSize };
}

/**
 * Full directory search with facet counts. Facet counts for a dimension ignore that
 * dimension's own filter, so users can see how many results each alternative would give.
 * @param {object[]} businesses
 * @param {DirectoryFilters} filters
 */
export function searchDirectory(businesses, filters = {}) {
  const query = prepareQuery(filters.q);
  const scores = new Map();

  const scored = businesses.filter((b) => {
    const s = scoreBusiness(b, query.tokens, query.raw);
    if (s > 0) scores.set(b.id, s);
    return s > 0;
  });

  const results = scored.filter((b) => passes(b, filters, query));
  const facetBase = (skip) => scored.filter((b) => passes(b, filters, query, skip));

  const facets = {
    categories: countBy(facetBase('category'), (b) => b.categories ?? [b.category]),
    locations: countBy(facetBase('location'), (b) => [b.area, b.parish]),
    types: countBy(facetBase('type'), (b) => (b.businessType ? [b.businessType] : [])),
    amenities: countBy(facetBase('amenities'), (b) => b.amenities ?? []),
    featured: facetBase('featured').filter((b) => b.isFeatured).length,
  };

  const sorted = sortBusinesses(results, filters.sort, scores);
  const pageData = paginate(sorted, filters.page, filters.pageSize ?? DEFAULT_PAGE_SIZE);

  return {
    ...pageData,
    total: results.length,
    facets,
    interpretedLocation: query.location ? describeLocation(query.location) : null,
  };
}

/** Related listings: same category in the same area first, then same category in the same parish. */
export function findRelated(businesses, business, limit = 3) {
  const others = businesses.filter((b) => b.id !== business.id && b.status === 'published');
  const sameCategory = (b) => (b.categories ?? [b.category]).includes(business.category);
  const tiers = [
    others.filter((b) => sameCategory(b) && b.area === business.area),
    others.filter(
      (b) => sameCategory(b) && b.parish === business.parish && b.area !== business.area,
    ),
    others.filter((b) => sameCategory(b) && b.parish !== business.parish),
  ];
  const result = [];
  for (const tier of tiers) {
    for (const b of tier.sort((x, y) => x.name.localeCompare(y.name))) {
      if (result.length < limit) result.push(b);
    }
  }
  return result;
}
