import { cleanLine } from '../utils/text.js';
import { singular, type CategoryEntry, type Lexicon, type LocationEntry } from './lexicon.js';

export type Intent =
  | 'greeting'
  | 'security_probe'
  | 'fabrication_request'
  | 'out_of_scope'
  | 'live_info'
  | 'listing_detail'
  | 'directory_search'
  | 'business_prospecting'
  | 'product_availability'
  | 'general_info';

export type Attribute = 'opening_hours' | 'contact' | 'price' | 'amenities' | 'address' | 'booking' | 'accessibility';

export interface QueryAnalysis {
  original: string;
  normalized: string;
  intent: Intent;
  /** Words that carry the question's meaning (never emptied by stop-word removal of a short query). */
  keyTerms: string[];
  /** Multi-word expressions to match as phrases, e.g. "test strips". */
  phrases: string[];
  /** Things the user wants to buy/sell/find that are not a category or a place. */
  productTerms: string[];
  /** Descriptive phrases left after removing intent/category/location words (used as follow-up refinements). */
  descriptors: string[];
  categories: Array<Pick<CategoryEntry, 'id' | 'slug' | 'name'> & { matched: string }>;
  locations: Array<Pick<LocationEntry, 'id' | 'slug' | 'name' | 'type'> & { matched: string }>;
  listings: Array<{ id: string; name: string; slug: string }>;
  attribute: Attribute | null;
  /** "they sell X to Y" vs "Y sells X" — kept explicit so the answer never confuses them. */
  relation: 'user_sells_to' | 'user_buys' | 'none';
  anaphora: boolean;
  /** Refers to ONE thing (it / that place / this business), as opposed to a set (those / which ones). */
  singularReference: boolean;
  /** "this area", "here", "near me" without a known place. */
  locationReference: boolean;
  ordinal: number | null;
  liveKind: 'weather' | 'booking_action' | 'live_price' | 'live_availability' | 'news' | null;
  flags: string[];
}

// Stop words removed from keyword terms. Deliberately excludes nouns and negations.
const STOP = new Set(
  'a an the and or but if of to in on at by for with from into onto about as is are was were be been being do does did doing have has had i me my mine we us our you your he she it its they them their this that these those there here what which who whom whose when where why how can could would should will shall may might must please any some all just only also very really get got find finding show list tell give know looking look need want wanted like near nearby around best good great place places thing things one ones listed list directory ai bajan barbados island let lets im id ive whats wheres hows business businesses company companies actually instead either rather maybe'.split(' '),
);
// Verbs/relations: removed from keyword terms (they caused AND-style mismatches) but recorded.
const RELATION_WORDS = new Set(['sell', 'selling', 'sells', 'sold', 'buy', 'buying', 'buys', 'bought', 'purchase', 'purchasing', 'purchases', 'stock', 'stocks', 'stocking', 'carry', 'carries', 'supply', 'supplies', 'supplier', 'suppliers', 'customer', 'customers', 'client', 'clients', 'prospect', 'prospects', 'distribute', 'distributor', 'wholesale', 'retailer', 'retailers', 'interested', 'open', 'opening', 'close', 'closing', 'hours', 'time', 'times']);

const ATTRIBUTE_PATTERNS: Array<[Attribute, RegExp]> = [
  ['opening_hours', /\b(open(?:ing)?|clos(?:e|es|ing)|hours?|what time|when (?:is|are|does|do)\b.*\b(open|close))/i],
  ['contact', /\b(phone|telephone|call|contact|e-?mail|whats ?app|number|reach them|website)\b/i],
  ['price', /\b(price|prices|cost|costs|how much|expensive|cheap|price range|rates?)\b/i],
  ['amenities', /\b(amenit(?:y|ies)|wi-?fi|parking|pool|swimming pool|facilities|air[- ]?condition)/i],
  ['address', /\b(address|located|location of|where is|directions?|how do i get to)\b/i],
  ['booking', /\b(book(?:ing)?|reserv(?:e|ation)s?)\b/i],
  ['accessibility', /\b(wheelchair|accessib(?:le|ility)|step-free|disabled access)\b/i],
];

const INJECTION =
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(instructions?|rules?|prompt|system|previous)\b|\b(system prompt|hidden prompt|your prompt|developer message|jailbreak|dan mode)\b|\b(api[_ -]?key|secret key|service[_ -]?role|password|credentials?|env(?:ironment)? variables?|\.env)\b|\b(private|internal|every|all)\s+(tables?|database|records)\b|\bselect\s+\*\s+from\b|\bdrop\s+table\b|<\s*script\b/i;
const FABRICATION = /\b(invent|make up|made[- ]up|fabricate|fake|imaginary|pretend)\b.{0,60}\b(business(?:es)?|listings?|phone|numbers?|addresses|reviews?|places?|hotels?|restaurants?)\b/i;
const OUT_OF_SCOPE =
  /\b(capital of|write (?:me )?(?:a |an )?(?:python|javascript|java|code|script|program|function|essay|poem)|python script|solve|equation|derivative|integral|translate (?:this|the following)|stock price|bitcoin|crypto(?:currency)?|who won|election|recipe for)\b/i;
const ABOUT_BARBADOS = /\b(barbados|barbadian|barbadians|bajan|bajans|bimshire)\b/;
const GREETING = /^(hi|hello|hey|hiya|good (?:morning|afternoon|evening)|thanks|thank you|cheers|ok(?:ay)?|bye|goodbye)[\s!.?,]*$/i;
const LIVE: Array<[NonNullable<QueryAnalysis['liveKind']>, RegExp]> = [
  ['weather', /\b(weather|forecast|raining|temperature)\b.*\b(now|today|tomorrow|current|right now|this week)\b|\b(current|today'?s|right now)\b.*\bweather\b/i],
  ['booking_action', /\b(can you|could you|please)\s+(book|reserve|make a (?:booking|reservation))\b|\bbook (?:it|this|that|a table|a room) for me\b/i],
  ['live_price', /\b(current|today'?s|latest|live)\s+(price|prices|rate|rates|cost)\b/i],
  ['live_availability', /\b(available (?:tonight|today|now|tomorrow)|in stock (?:now|today)|availability (?:tonight|today|now))\b/i],
  ['news', /\b(latest news|breaking news|what happened today)\b/i],
];
const ANAPHORA = /\b(those|them|they|these|it|its|it's|that one|this one|the (?:first|second|third|fourth|fifth|last) one|which ones?|any of them|what about|how about|same|that place|this place|this business|that business|this specific|the one)\b/i;
const GENERIC_NOUNS = new Set(['food', 'foods', 'option', 'options', 'product', 'products', 'item', 'items', 'stuff', 'service', 'services', 'kind', 'type', 'types', 'stores', 'store', 'shops', 'ones', 'one']);
const SINGULAR_REF = /\b(it|its|that one|this one|that place|this place|this business|that business|this specific|the one|there)\b/i;
const LOCATION_REF = /\b(this area|this location|this place|around here|near me|nearby|close by|in the area|here)\b/i;
const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, '1st': 1, '2nd': 2, '3rd': 3, '4th': 4, '5th': 5 };

/** Lowercase, strip accents and punctuation (keeping & and -), collapse spaces. */
export function normalizeQuery(q: string): string {
  return cleanLine(q)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9&\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const hasPhrase = (text: string, phrase: string) => new RegExp(`(?:^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\s)`).test(text);

function matchCategories(norm: string, lexicon: Lexicon) {
  const hits: QueryAnalysis['categories'] = [];
  for (const c of lexicon.categories) {
    const matched = c.terms.filter((t) => hasPhrase(norm, t)).sort((a, b) => b.length - a.length)[0];
    if (matched) hits.push({ id: c.id, slug: c.slug, name: c.name, matched });
  }
  // Prefer the most specific match: drop a parent when its child matched on the same term.
  return hits.filter((h) => !hits.some((o) => o !== h && lexicon.categories.find((c) => c.id === o.id)?.parentId === h.id && o.matched === h.matched));
}

function matchLocations(norm: string, lexicon: Lexicon) {
  const hits: QueryAnalysis['locations'] = [];
  for (const l of lexicon.locations) {
    const matched = l.terms.filter((t) => hasPhrase(norm, t)).sort((a, b) => b.length - a.length)[0];
    if (matched) hits.push({ id: l.id, slug: l.slug, name: l.name, type: l.type, matched });
  }
  // A shorter name contained in a longer matched one ("Bay" inside "Carlisle Bay") is dropped.
  return hits.filter((h) => !hits.some((o) => o !== h && o.matched.length > h.matched.length && o.matched.includes(h.matched)));
}

function matchListings(norm: string, lexicon: Lexicon) {
  return lexicon.listingNames.filter((l) => {
    const name = normalizeQuery(l.name);
    return name.length >= 4 && hasPhrase(norm, name);
  });
}

export function analyzeQuery(input: string, lexicon: Lexicon): QueryAnalysis {
  const original = cleanLine(input);
  const norm = normalizeQuery(original);
  const flags: string[] = [];

  const categories = matchCategories(norm, lexicon);
  const locations = matchLocations(norm, lexicon);
  const listings = matchListings(norm, lexicon);

  // Remove matched category/location/listing phrases before extracting the remaining terms.
  let rest = ` ${norm} `;
  for (const m of [...categories.map((c) => c.matched), ...locations.map((l) => l.matched), ...listings.map((l) => normalizeQuery(l.name))]) {
    rest = rest.replace(` ${m} `, ' ');
  }
  const words = rest.split(' ').filter(Boolean);
  const content = words.filter((w) => !STOP.has(w) && !RELATION_WORDS.has(w) && w.length > 1 && !/^\d+$/.test(w));

  // Adjacent content words form phrases ("test strips", "swimming pools").
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const [a, b] = [words[i], words[i + 1]];
    if (content.includes(a) && content.includes(b)) phrases.push(`${a} ${b}`);
  }

  const relation: QueryAnalysis['relation'] =
    /\b(sell|selling|supply|supplying|distribute)\b.*\bto\b|\b(buy|purchase)\b.*\bfrom me\b|\b(customers?|clients?|buyers?|prospects?|retailers?|stockists?)\b.*\b(for|to)\b|\bwho (?:could|would|might|will) (?:buy|purchase)\b|\bwhere (?:can|could|do) i sell\b|\bmight (?:purchase|buy)\b/.test(norm)
      ? 'user_sells_to'
      : /\b(where|which|who)\b.*\b(buy|purchase|get|find)\b|\b(sell|sells|stock|stocks|carry|carries)\b/.test(norm) && !/\bsell\b.*\bto\b/.test(norm)
        ? 'user_buys'
        : 'none';

  const attribute = ATTRIBUTE_PATTERNS.find(([, re]) => re.test(norm))?.[0] ?? null;
  const anaphora = ANAPHORA.test(norm);
  const singularReference = SINGULAR_REF.test(norm) && !/\b(which ones|those|these|them|any of them)\b/.test(norm);
  const locationReference = LOCATION_REF.test(norm) && !locations.length;
  const ordinalWord = norm.match(/\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/)?.[1];
  const ordinal = ordinalWord ? ORDINALS[ordinalWord] : null;
  const liveKind = LIVE.find(([, re]) => re.test(norm))?.[0] ?? null;

  // Key terms: content words + their singular forms. If stop-word removal emptied a short query,
  // fall back to the original non-trivial words rather than treating the query as "empty".
  let keyTerms = [...new Set(content.flatMap((w) => [w, singular(w)]))];
  if (!keyTerms.length && !categories.length && !locations.length && !listings.length) {
    keyTerms = [...new Set(words.filter((w) => w.length > 2 && !['the', 'and', 'you', 'are', 'how'].includes(w)))];
    if (keyTerms.length) flags.push('stopword_fallback');
  }
  // Generic head nouns ("vegan food", "vegetarian options") are not required to match literally.
  const stripGeneric = (p: string) => p.split(' ').filter((w) => !GENERIC_NOUNS.has(w)).join(' ');
  const productTerms = [...new Set((phrases.length ? phrases : content.filter((w) => w.length > 2)).map(stripGeneric).filter((p) => p.length > 2))];

  let intent: Intent;
  if (INJECTION.test(original)) intent = 'security_probe';
  else if (FABRICATION.test(norm)) intent = 'fabrication_request';
  else if (GREETING.test(original.trim())) intent = 'greeting';
  // Questions about Barbados itself ("capital of Barbados", "Bajan history") are always in scope.
  else if (OUT_OF_SCOPE.test(norm) && !categories.length && !listings.length && !locations.length && !ABOUT_BARBADOS.test(norm)) intent = 'out_of_scope';
  else if (liveKind) intent = 'live_info';
  else if (relation === 'user_sells_to') intent = 'business_prospecting';
  else if (listings.length && (attribute || anaphora || words.length <= 8)) intent = 'listing_detail';
  else if (attribute && (singularReference || /\b(this|that) (?:specific )?(?:listed )?(?:business|place|restaurant|hotel|shop)\b/.test(norm)) && !categories.length) intent = 'listing_detail';
  else if (relation === 'user_buys' && productTerms.length && !(categories.length && !content.length)) intent = 'product_availability';
  else if (categories.length) intent = 'directory_search';
  else intent = 'general_info';

  return {
    original,
    normalized: norm,
    intent,
    keyTerms,
    phrases,
    productTerms: intent === 'business_prospecting' || intent === 'product_availability' ? productTerms : [],
    descriptors: productTerms,
    categories,
    locations,
    listings,
    attribute,
    relation,
    anaphora,
    singularReference,
    locationReference,
    ordinal,
    liveKind,
    flags,
  };
}
