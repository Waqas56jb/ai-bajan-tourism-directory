/**
 * Builds "col = $n" lists from a whitelist-mapped object. Column names are always taken from code
 * (the `columns` map), never from request keys.
 */
export function buildSet(
  values: Record<string, unknown>,
  columns: Record<string, string>,
  startIndex = 1,
  jsonColumns: ReadonlySet<string> = new Set(),
) {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, value] of Object.entries(values)) {
    const col = columns[key];
    if (!col || value === undefined) continue;
    params.push(jsonColumns.has(col) ? JSON.stringify(value) : value);
    sets.push(`${col} = $${startIndex + params.length - 1}`);
  }
  return { sets, params };
}

/** Escape LIKE wildcards in user search text. */
export const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export function orderBy(sort: string, dir: 'asc' | 'desc', allowed: Record<string, string>, fallback: string) {
  const col = allowed[sort] ?? allowed[fallback];
  return `${col} ${dir === 'asc' ? 'asc' : 'desc'} nulls last`;
}
