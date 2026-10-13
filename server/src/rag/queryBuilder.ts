/**
 * Builds a to_tsquery() string from analysed terms. Every token is reduced to [a-z0-9] so no user
 * syntax (&, !, :, quotes, parentheses) can reach the PostgreSQL tsquery parser.
 *
 * Terms are OR-ed (|), not AND-ed: a short question like "pharmacies to sell test strips to" must
 * still match a chunk that only says "pharmacy". Precision comes from ranking and evidence checks,
 * not from requiring every word to co-occur in one chunk (the classic cause of "insufficient").
 */
const token = (w: string) =>
  w
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export function buildTsQuery(terms: string[], phrases: string[] = []): string | null {
  const parts = new Set<string>();
  for (const p of phrases) {
    const words = p.split(/\s+/).map(token).filter((w) => w.length > 1);
    if (words.length > 1) parts.add(`(${words.join(' <-> ')})`);
  }
  for (const t of terms) {
    for (const w of t.split(/\s+/).map(token)) {
      if (w.length > 1 && w.length <= 40) parts.add(w);
    }
  }
  if (!parts.size) return null;
  return [...parts].slice(0, 24).join(' | ');
}
