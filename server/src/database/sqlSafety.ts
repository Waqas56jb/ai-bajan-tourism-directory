/**
 * Static guard for migration SQL. Migrations must be additive and must only create objects that
 * carry the AI Bajan prefix. This is a safety net on top of code review, not a SQL parser.
 */
export const PREFIX = 'website_with_rag_';

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\bdrop\s+(table|schema|database|extension|view|materialized\s+view|function|trigger|policy|index|type|role)\b/i, 'DROP statements are not allowed'],
  [/\btruncate\b/i, 'TRUNCATE is not allowed'],
  [/\bdelete\s+from\b/i, 'DELETE is not allowed in migrations'],
  [/\balter\s+(system|database|extension|role|default\s+privileges)\b/i, 'database-wide ALTER is not allowed'],
  [/\bcreate\s+extension\b/i, 'creating extensions is not allowed (pgvector is reused from the extensions schema)'],
  [/\bgrant\b/i, 'GRANT is not allowed (browser roles get no direct access)'],
];

const NAMED_OBJECT =
  /\bcreate\s+(?:or\s+replace\s+)?(?:unique\s+)?(table|index|function|trigger|view)\s+(?:if\s+not\s+exists\s+)?(?:[a-z_{}]+\.)?([a-z0-9_"]+)/gi;

export interface SafetyReport {
  ok: boolean;
  problems: string[];
  createdObjects: Array<{ kind: string; name: string }>;
}

/** Strip comments and dollar-quoted bodies so keywords inside function bodies don't trip the scan. */
function stripBodies(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\$\$[\s\S]*?\$\$/g, '$$ $$');
}

export function checkMigrationSql(sql: string): SafetyReport {
  const problems: string[] = [];
  const outer = stripBodies(sql);
  for (const [re, message] of FORBIDDEN) if (re.test(outer)) problems.push(message);

  // Function bodies are checked too: DDL there would execute just the same.
  const bodies = sql.match(/\$\$[\s\S]*?\$\$/g) ?? [];
  for (const body of bodies) {
    if (/\b(drop|truncate)\s/i.test(body.replace(/--[^\n]*/g, ''))) {
      problems.push('DROP/TRUNCATE inside a function body is not allowed');
    }
  }

  const createdObjects: SafetyReport['createdObjects'] = [];
  for (const m of outer.matchAll(NAMED_OBJECT)) {
    const name = m[2].replace(/"/g, '');
    createdObjects.push({ kind: m[1].toLowerCase(), name });
    if (!name.startsWith(PREFIX)) problems.push(`${m[1]} "${name}" does not use the ${PREFIX} prefix`);
  }
  return { ok: problems.length === 0, problems, createdObjects };
}
