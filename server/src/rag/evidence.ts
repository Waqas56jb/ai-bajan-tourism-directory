import type { MemoryResolution } from './memory.js';
import type { QueryAnalysis } from './queryAnalysis.js';
import type { Candidate, RetrievalResult } from './retrieval.js';
import { textHasTerm } from './retrieval.js';

export type EvidenceLevel = 'strong' | 'partial' | 'ambiguous' | 'none' | 'failure';

export interface EvidenceAssessment {
  level: EvidenceLevel;
  /** Sources chosen for the answer, best first. */
  selected: Candidate[];
  /** Listing candidates that answer a directory-style request. */
  listings: Candidate[];
  caveats: Array<'product_not_verified' | 'purchase_interest_not_verified' | 'attribute_missing' | 'location_unresolved' | 'refinement_not_matched' | 'degraded_retrieval'>;
  reasons: string[];
  clarification: string | null;
}

export interface EvidenceThresholds {
  strongCoverage: number;
  partialCoverage: number;
  strongSimilarity: number;
  minSimilarity: number;
}

export const DEFAULT_THRESHOLDS: EvidenceThresholds = {
  strongCoverage: 0.6,
  partialCoverage: 0.34,
  strongSimilarity: 0.5,
  minSimilarity: 0.25,
};

const ATTRIBUTE_LINES: Record<NonNullable<QueryAnalysis['attribute']>, RegExp> = {
  opening_hours: /^Opening hours:/m,
  contact: /^(Phone|Email|Website|WhatsApp):/m,
  price: /^Price range:/m,
  amenities: /^Amenities:/m,
  address: /^(Address|Area):/m,
  booking: /^(Booking|Booking link):/m,
  accessibility: /^Accessibility:/m,
};

export const candidateText = (c: Candidate) => c.chunks.map((x) => x.chunk_text).join('\n');

/**
 * Decide how well the retrieved sources support an answer. Uses observable signals only —
 * structured category matches, term coverage, keyword rank and vector similarity — never the
 * model's own confidence.
 */
export function assessEvidence(
  a: QueryAnalysis,
  r: RetrievalResult,
  memory: Pick<MemoryResolution, 'unresolved'>,
  contextLimit: number,
  th: EvidenceThresholds = DEFAULT_THRESHOLDS,
): EvidenceAssessment {
  const reasons: string[] = [];
  const caveats: EvidenceAssessment['caveats'] = [];
  if (r.errors.length && !r.failed) caveats.push('degraded_retrieval');

  if (r.failed) {
    return { level: 'failure', selected: [], listings: [], caveats, reasons: ['all retrieval methods failed'], clarification: null };
  }

  if (memory.unresolved === 'listing_reference') {
    return {
      level: 'ambiguous',
      selected: [],
      listings: [],
      caveats,
      reasons: ['the question refers to a business that is not identified'],
      clarification: 'Which business do you mean? Tell me its name and I’ll look up the details.',
    };
  }

  const relevant = (c: Candidate) =>
    c.signals.structured ||
    c.coverage >= th.partialCoverage ||
    (c.signals.vectorSimilarity ?? 0) >= th.strongSimilarity ||
    ((c.signals.vectorSimilarity ?? 0) >= th.minSimilarity && c.coverage > 0);
  const pool = r.candidates.filter(relevant);

  // ---------------------------------------------------------------- single listing questions
  if (a.intent === 'listing_detail') {
    const ids = new Set(a.listings.map((l) => l.id));
    const target = r.candidates.filter((c) => c.sourceType === 'listing' && ids.has(c.sourceId));
    if (!target.length) {
      return { level: 'none', selected: [], listings: [], caveats, reasons: ['named business not found among eligible listings'], clarification: null };
    }
    const hasAttr = a.attribute ? target.some((c) => ATTRIBUTE_LINES[a.attribute!].test(candidateText(c))) : true;
    if (!hasAttr) caveats.push('attribute_missing');
    return { level: hasAttr ? 'strong' : 'partial', selected: target.slice(0, contextLimit), listings: target, caveats, reasons: [`listing matched${hasAttr ? '' : `; ${a.attribute} not in listing`}`], clarification: null };
  }

  // ---------------------------------------------------------------- directory-style requests
  const directoryLike = ['directory_search', 'business_prospecting', 'product_availability'].includes(a.intent);
  if (directoryLike) {
    let listings = pool.filter((c) => c.sourceType === 'listing' && (c.signals.structured || c.signals.categoryMatch || c.productMatch));
    // An explicit location from the user is a hard constraint for directory results.
    if (a.locations.length) listings = listings.filter((c) => c.signals.locationMatch);
    if (a.locationReference) caveats.push('location_unresolved');

    if (a.productTerms.length) {
      const withProduct = listings.filter((c) => c.productMatch);
      // Listings outside the category that explicitly mention the product (e.g. a clinic that
      // stocks test strips) are relevant for availability/prospecting questions.
      const extra = pool.filter((c) => c.sourceType === 'listing' && c.productMatch && !listings.includes(c));
      if (a.intent === 'directory_search') {
        // A refinement on a category search ("which ones have pools"): show only matching ones.
        if (withProduct.length) listings = withProduct;
        else caveats.push('refinement_not_matched');
      } else {
        listings = [...withProduct, ...extra, ...listings.filter((c) => !c.productMatch)];
        if (!withProduct.length && !extra.length) caveats.push('product_not_verified');
      }
    }
    if (a.intent === 'business_prospecting') caveats.push('purchase_interest_not_verified');

    const supporting = pool.filter((c) => c.sourceType !== 'listing' && c.coverage >= th.partialCoverage).slice(0, 3);
    if (listings.length) {
      const level: EvidenceLevel = caveats.includes('refinement_not_matched') ? 'partial' : 'strong';
      reasons.push(`${listings.length} listing(s) matched by ${a.categories.length ? 'category' : 'keyword'}`);
      return { level, selected: [...listings, ...supporting].slice(0, contextLimit), listings: listings.slice(0, contextLimit), caveats, reasons, clarification: null };
    }
    if (supporting.length) {
      return { level: 'partial', selected: supporting, listings: [], caveats, reasons: ['no matching listings; related knowledge found'], clarification: null };
    }
    return {
      level: 'none',
      selected: [],
      listings: [],
      caveats,
      reasons: [a.categories.length ? 'category has no eligible listings' : 'no listing mentions the requested product'],
      clarification: null,
    };
  }

  // ---------------------------------------------------------------- general questions
  if (!pool.length) {
    return { level: 'none', selected: [], listings: [], caveats, reasons: ['no source passed relevance checks'], clarification: null };
  }
  const best = pool[0];
  const strong =
    best.coverage >= th.strongCoverage ||
    (best.signals.vectorSimilarity ?? 0) >= th.strongSimilarity ||
    (best.signals.structured && best.signals.categoryMatch);
  reasons.push(`best source coverage ${best.coverage.toFixed(2)}${best.signals.vectorSimilarity !== null ? `, similarity ${best.signals.vectorSimilarity.toFixed(2)}` : ''}`);
  const listings = pool.filter((c) => c.sourceType === 'listing' && (c.signals.categoryMatch || c.coverage >= th.strongCoverage));
  return { level: strong ? 'strong' : 'partial', selected: pool.slice(0, contextLimit), listings: listings.slice(0, contextLimit), caveats, reasons, clarification: null };
}

/** Does the text answer the specific attribute? Exposed for tests. */
export const hasAttributeLine = (text: string, attribute: NonNullable<QueryAnalysis['attribute']>) => ATTRIBUTE_LINES[attribute].test(text);
export { textHasTerm };
