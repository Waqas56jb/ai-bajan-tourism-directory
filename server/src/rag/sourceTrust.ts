/**
 * Barbados Trusted Information Network: how much the assistant trusts each source.
 *
 *   official      Government of Barbados and statutory bodies (gov.bb sites, Transport Board,
 *                 Central Bank, Meteorological Services)
 *   institutional Barbadian institutions (Visit Barbados, National Trust, Museum, NCF, UWI, SBA,
 *                 BHTA, Export Barbados)
 *   local         AI Bajan's own verified content: directory listings, FAQs, approved adverts,
 *                 documents written by the team, and local services such as Transit246
 *   publication   Reputable local publications and guides (barbados.org; licensed news)
 *   background    General reference (Wikipedia): used only when nothing better covers the question
 *
 * The tier multiplies the retrieval score. For questions about fees, laws, licences, schedules
 * and current information, background sources are pushed down further so that authoritative
 * pages are preferred whenever they cover the question.
 */
export type TrustTier = 'official' | 'institutional' | 'local' | 'publication' | 'background';

const HOST_TIERS: Array<[RegExp, TrustTier]> = [
  [/(^|\.)gov\.bb$/, 'official'],
  [/(^|\.)transportboard\.com$/, 'official'],
  [/(^|\.)centralbank\.org\.bb$/, 'official'],
  [/(^|\.)barbadosweather\.org$/, 'official'],
  [/(^|\.)visitbarbados\.org$/, 'institutional'],
  [/(^|\.)barbadosnationaltrust\.com$/, 'institutional'],
  [/(^|\.)barbmuse\.org\.bb$/, 'institutional'],
  [/(^|\.)ncf\.bb$/, 'institutional'],
  [/(^|\.)uwi\.edu$/, 'institutional'],
  [/(^|\.)bhta\.org$/, 'institutional'],
  [/(^|\.)(exportbarbados|bidc)\.org$/, 'institutional'],
  [/(^|\.)sba\.bb$/, 'institutional'],
  [/(^|\.)transit246\.com$/, 'local'],
  [/(^|\.)barbados\.org$/, 'publication'],
  [/(^|\.)(barbadostoday\.bb|nationnews\.com)$/, 'publication'],
  [/(^|\.)wikipedia\.org$/, 'background'],
];

export const TIER_WEIGHT: Record<TrustTier, number> = {
  official: 1.35,
  institutional: 1.2,
  local: 1.0,
  publication: 0.9,
  background: 0.6,
};
/** Extra multiplier for background sources when the question needs an authoritative answer. */
const BACKGROUND_PENALTY_AUTHORITATIVE = 0.5;

export const TIER_LABEL: Record<TrustTier, string> = {
  official: 'official government source',
  institutional: 'Barbadian institution',
  local: 'AI Bajan verified information',
  publication: 'local publication',
  background: 'general background reference',
};

export function hostOf(url: unknown): string | null {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Tier of a retrieved source. Content without an external URL is AI Bajan's own (listings, FAQs, team documents). */
export function trustTier(sourceType: string, metadata: Record<string, unknown>): TrustTier {
  const host = hostOf(metadata.sourceUrl);
  if (!host) return 'local';
  for (const [re, tier] of HOST_TIERS) if (re.test(host)) return tier;
  return sourceType === 'document' ? 'publication' : 'local';
}

const AUTHORITATIVE =
  /\b(fees?|costs?|charges?|price of|laws?|legal(ly)?|legislation|regulations?|licen[cs]es?|permits?|passports?|registers?|registration|apply|application|requirements?|documents? (do i )?need|tax(es)?|vat|nis|pensions?|benefits?|bus(es)?|routes?|timetables?|schedules?|fares?|current(ly)?|latest|today|now|this (week|weekend|month)|weather|hurricane|storm|rates?|statistics|inflation|minimum wage)\b/i;

/** True when the question is about fees, laws, licences, schedules or current information. */
export const needsAuthoritativeSource = (question: string) => AUTHORITATIVE.test(question);

export function trustWeight(tier: TrustTier, authoritative: boolean): number {
  return TIER_WEIGHT[tier] * (authoritative && tier === 'background' ? BACKGROUND_PENALTY_AUTHORITATIVE : 1);
}
