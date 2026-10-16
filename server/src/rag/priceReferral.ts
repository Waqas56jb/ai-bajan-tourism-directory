import type { SourceRef } from './generator.js';
import type { QueryAnalysis } from './queryAnalysis.js';

/**
 * Shopping and price questions are referred to AskDealia (askdealia.gov.bb), the Department of
 * Commerce and Consumer Affairs' price-comparison service, with a link to its results for the
 * product. AI Bajan links to AskDealia; it does not copy AskDealia's prices or data, whose terms
 * require written permission for automated access and reuse.
 */
const PRICE_QUESTION =
  /\b(price[sd]?|pricing|cost(s|ing)?|cheap(er|est)?|expensive|afford(able)?|how much|special[s]?|promotions?|deals?|on sale|discount(s|ed)?|bargain|compare|comparison)\b/i;
const SHOPPING =
  /\b(supermarkets?|grocer(y|ies)|groceries|shop(s|ping)?|stores?|buy|purchase|food|rice|flour|sugar|milk|bread|eggs|chicken|fish|salt ?fish|cheese|oil|juice|cereal|detergent|toiletr(y|ies)|baby (food|formula)|diapers|vegetables|fruits?|meat|household|items?|products?|brand)\b/i;
/** Prices that are not supermarket goods (government fees, fares, rents) are answered from their own sources. */
const NOT_GROCERY = /\b(fees?|fares?|bus|taxi|licen[cs]e|passport|permit|tax|rent|apartment|house|land|car|vehicle|flight|hotel|tuition|school|insurance|electricity|water bill)\b/i;
const FILLER = new Set(
  'what where which who how much many is are the a an of in on at for to from do does can i me my we our you your there any best cheapest cheaper price prices pricing cost costs buy purchase get find compare comparison barbados bajan supermarket supermarkets grocery groceries store stores shop shops shopping now today this week weeks current currently latest special specials deal deals promotion promotions sale under over than and or with near bds bbd dollar dollars'.split(
    ' ',
  ),
);

export const ASKDEALIA = 'https://askdealia.gov.bb';

/** True for questions about the price of supermarket/household goods. */
export function isShoppingPriceQuestion(question: string): boolean {
  return PRICE_QUESTION.test(question) && SHOPPING.test(question) && !NOT_GROCERY.test(question);
}

/** A link to AskDealia's results for the product the user asked about (or its home page). */
export function priceReferral(a: QueryAnalysis): SourceRef | null {
  if (!isShoppingPriceQuestion(a.original)) return null;
  const words = (a.productTerms.length ? a.productTerms.join(' ') : a.normalized)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !FILLER.has(w) && !/^\d+$/.test(w));
  const product = [...new Set(words)].slice(0, 4).join(' ');
  return {
    id: 'askdealia',
    type: 'document',
    title: product ? `AskDealia: current prices for “${product}”` : 'AskDealia: compare supermarket prices',
    url: product ? `${ASKDEALIA}/search/${encodeURIComponent(product)}` : ASKDEALIA,
    tier: 'official',
    updatedAt: null,
  };
}

/** Sentence added to answers about supermarket prices. */
export const PRICE_REFERRAL_TEXT =
  'For current supermarket prices and promotions, compare them on AskDealia, the Government of Barbados price-comparison service (Department of Commerce and Consumer Affairs). Prices change often, so check with the retailer before you buy.';
