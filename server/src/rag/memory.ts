import type { QueryAnalysis } from './queryAnalysis.js';

/**
 * Structured conversation memory. Only facts the conversation itself established are kept
 * (filters the user chose, listings the assistant showed). It is context, never a knowledge source,
 * and it is never treated as instructions.
 */
export interface MemoryState {
  category?: { id: string; slug: string; name: string } | null;
  location?: { id: string; slug: string; name: string; type: string } | null;
  refinement?: string[];
  productTerms?: string[];
  intent?: string;
  /** Listings shown in the last answer, in display order (for "the second one"). */
  listings?: Array<{ id: string; name: string }>;
  /** A clarification question we asked and are waiting on. */
  pendingClarification?: string | null;
  turns?: number;
}

export interface MemoryResolution {
  analysis: QueryAnalysis;
  used: string[];
  cleared: string[];
  /** Listing explicitly referenced via ordinal/pronoun. */
  referencedListing: { id: string; name: string } | null;
  /** Needs clarification because a reference can't be resolved. */
  unresolved: 'listing_reference' | null;
}

const FOLLOW_UP =
  /^(?:(?:actually|no|ok(?:ay)?|well|hmm|then|so|but)\s+)*(and|also|what about|how about|only|just|which ones?|any (?:of them|with)|ones? (?:with|that)|do any|does it|do they|is it|are they|show me (?:only|just)|same|now)\b|\b(ones|instead|those|them)\b/;
const ACCUMULATE = /\b(also|as well|too|and also)\b/;

/**
 * Merge the current query with relevant memory. Rules:
 *  - A follow-up without its own category inherits the previous category (and location).
 *  - A new category WITHOUT follow-up wording starts a new topic: old location/refinements are
 *    not carried over (no silent location restrictions from an unrelated earlier question).
 *  - A follow-up that names a new location keeps the category and replaces the location.
 *  - Leftover descriptive terms on a follow-up become a refinement ("with swimming pools").
 *  - Ordinals / pronouns resolve against the listings shown in the previous answer.
 */
export function resolveWithMemory(input: QueryAnalysis, state: MemoryState): MemoryResolution {
  const a: QueryAnalysis = { ...input, categories: [...input.categories], locations: [...input.locations], productTerms: [...input.productTerms] };
  const used: string[] = [];
  const cleared: string[] = [];
  let referencedListing: MemoryResolution['referencedListing'] = null;
  let unresolved: MemoryResolution['unresolved'] = null;

  const passthrough = ['greeting', 'security_probe', 'fabrication_request', 'out_of_scope'].includes(a.intent);
  if (passthrough) return { analysis: a, used, cleared, referencedListing, unresolved };

  const followUp = FOLLOW_UP.test(a.normalized) || a.anaphora || a.locationReference;
  const hadTopic = Boolean(state.category || state.listings?.length);

  // Ordinal / pronoun reference to a listing shown before.
  if (!a.listings.length && state.listings?.length) {
    if (a.ordinal) {
      const pick = a.ordinal === 5 && /\blast\b/.test(a.normalized) ? state.listings.at(-1) : state.listings[a.ordinal - 1];
      if (pick) referencedListing = pick;
    } else if (/\b(the last one)\b/.test(a.normalized)) referencedListing = state.listings.at(-1) ?? null;
    else if (a.singularReference && !a.categories.length) {
      if (state.listings.length === 1) referencedListing = state.listings[0];
      else unresolved = 'listing_reference';
    }
  }
  if (referencedListing) {
    a.listings = [{ id: referencedListing.id, name: referencedListing.name, slug: '' }];
    a.intent = 'listing_detail';
    used.push(`listing:${referencedListing.name}`);
  } else if (a.intent === 'listing_detail' && !a.listings.length) {
    unresolved = 'listing_reference';
  }

  if (!a.categories.length && followUp && hadTopic && state.category && a.intent !== 'listing_detail') {
    a.categories = [{ ...state.category, matched: '(memory)' }];
    used.push(`category:${state.category.name}`);
    // Descriptive words left on a follow-up are a refinement of that category search.
    const refinement = a.descriptors;
    const keep = ACCUMULATE.test(a.normalized) ? state.refinement ?? [] : [];
    if (refinement.length) {
      a.productTerms = [...new Set([...keep, ...refinement])];
      used.push(`refinement:${a.productTerms.join(', ')}`);
    }
    if (a.intent === 'general_info') a.intent = state.intent === 'business_prospecting' ? 'business_prospecting' : 'directory_search';
    if (!a.productTerms.length && state.productTerms?.length && state.intent === a.intent) a.productTerms = state.productTerms;
  } else if (a.categories.length && state.category && a.categories[0].id !== state.category.id && !followUp) {
    if (state.location) cleared.push(`location:${state.location.name}`);
    if (state.refinement?.length) cleared.push('refinement');
  }

  // Location: explicit wins; "this area" or a follow-up inherits the last explicit location.
  if (!a.locations.length && state.location && (a.locationReference || (followUp && hadTopic))) {
    a.locations = [{ ...state.location, matched: '(memory)' }];
    a.locationReference = false;
    used.push(`location:${state.location.name}`);
  }

  return { analysis: a, used, cleared, referencedListing, unresolved };
}

/** Next memory state after answering. */
export function nextMemoryState(
  prev: MemoryState,
  resolved: QueryAnalysis,
  shownListings: Array<{ id: string; name: string }>,
  clarification: string | null,
): MemoryState {
  const passthrough = ['greeting', 'security_probe', 'fabrication_request', 'out_of_scope', 'live_info'].includes(resolved.intent);
  if (passthrough) return { ...prev, turns: (prev.turns ?? 0) + 1 };
  return {
    category: resolved.categories[0] ? { id: resolved.categories[0].id, slug: resolved.categories[0].slug, name: resolved.categories[0].name } : resolved.intent === 'listing_detail' ? prev.category ?? null : null,
    location: resolved.locations[0]
      ? { id: resolved.locations[0].id, slug: resolved.locations[0].slug, name: resolved.locations[0].name, type: resolved.locations[0].type }
      : resolved.intent === 'listing_detail' ? prev.location ?? null : null,
    refinement: resolved.productTerms.length && resolved.intent === 'directory_search' ? resolved.productTerms : [],
    productTerms: resolved.productTerms,
    intent: resolved.intent,
    listings: shownListings.length ? shownListings.slice(0, 10) : resolved.intent === 'listing_detail' ? prev.listings : [],
    pendingClarification: clarification,
    turns: (prev.turns ?? 0) + 1,
  };
}

/** Deterministic factual summary (no model call, so nothing can be invented). */
export function summarizeMemory(state: MemoryState): string {
  const parts: string[] = [];
  if (state.category) parts.push(`Topic: ${state.category.name}${state.location ? ` in ${state.location.name}` : ''}.`);
  else if (state.location) parts.push(`Area of interest: ${state.location.name}.`);
  if (state.refinement?.length) parts.push(`Refined by: ${state.refinement.join(', ')}.`);
  if (state.productTerms?.length && state.intent === 'business_prospecting') parts.push(`User wants to sell: ${state.productTerms.join(', ')}.`);
  if (state.listings?.length) parts.push(`Listings shown last: ${state.listings.map((l, i) => `${i + 1}. ${l.name}`).join('; ')}.`);
  if (state.pendingClarification) parts.push(`Waiting for the user to answer: ${state.pendingClarification}`);
  return parts.join(' ');
}
