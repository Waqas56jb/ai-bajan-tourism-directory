import type pg from 'pg';
import { PREFIX } from './sqlSafety.js';

/** Read-only fingerprint of every object that does NOT belong to AI Bajan. */
export interface Snapshot {
  tables: Map<string, { rls: boolean; columns: string; rows: number }>;
  functions: Set<string>;
  triggers: Set<string>;
  policies: Set<string>;
  extensions: Set<string>;
  buckets: Set<string>;
}

const notOurs = (name: string) => !name.startsWith(PREFIX);

export async function takeSnapshot(client: pg.Client | pg.PoolClient): Promise<Snapshot> {
  const tables = new Map<string, { rls: boolean; columns: string; rows: number }>();
  const t = await client.query(`
    select n.nspname as schema, c.relname as name, c.relrowsecurity as rls,
           (select string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by a.attnum)
              from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as columns
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r','p') and n.nspname = 'public'`);
  for (const row of t.rows) {
    if (!notOurs(row.name)) continue;
    const count = await client.query(`select count(*)::bigint as n from public.${client.escapeIdentifier(row.name)}`);
    tables.set(row.name, { rls: row.rls, columns: row.columns ?? '', rows: Number(count.rows[0].n) });
  }
  const set = async (sql: string) => new Set((await client.query(sql)).rows.map((r) => r.k as string));
  const functions = await set(`
    select n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || md5(pg_get_functiondef(p.oid)) as k
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prokind = 'f' and p.proname not like '${PREFIX}%'`);
  const triggers = await set(`
    select c.relname || '.' || t.tgname as k from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and not t.tgisinternal and c.relname not like '${PREFIX}%'`);
  const policies = await set(`
    select tablename || '.' || policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') as k
      from pg_policies where schemaname = 'public' and tablename not like '${PREFIX}%'`);
  const extensions = await set(`select extname || '@' || extversion as k from pg_extension`);
  let buckets = new Set<string>();
  try {
    buckets = await set(`select id as k from storage.buckets`);
  } catch {
    /* storage schema not available */
  }
  return { tables, functions, triggers, policies, extensions, buckets };
}

export function compareSnapshots(before: Snapshot, after: Snapshot) {
  const problems: string[] = [];
  const warnings: string[] = [];
  for (const [name, b] of before.tables) {
    const a = after.tables.get(name);
    if (!a) {
      problems.push(`unrelated table public.${name} disappeared`);
      continue;
    }
    if (a.columns !== b.columns) problems.push(`columns of unrelated table public.${name} changed`);
    if (a.rls !== b.rls) problems.push(`RLS flag of unrelated table public.${name} changed`);
    // Other applications keep running during a migration, so a row-count change is reported but
    // cannot be attributed to this run (migrations contain no DML on unrelated tables).
    if (a.rows !== b.rows) warnings.push(`public.${name} row count ${b.rows} -> ${a.rows} (live traffic from its own app)`);
  }
  for (const name of after.tables.keys()) {
    if (!before.tables.has(name)) problems.push(`new non-prefixed table public.${name} appeared`);
  }
  const diffSet = (label: string, x: Set<string>, y: Set<string>) => {
    for (const k of x) if (!y.has(k)) problems.push(`${label} changed or removed: ${k.slice(0, 120)}`);
    for (const k of y) if (!x.has(k)) problems.push(`${label} added: ${k.slice(0, 120)}`);
  };
  diffSet('unrelated function', before.functions, after.functions);
  diffSet('unrelated trigger', before.triggers, after.triggers);
  diffSet('unrelated policy', before.policies, after.policies);
  diffSet('extension', before.extensions, after.extensions);
  diffSet('storage bucket', before.buckets, after.buckets);
  return { problems, warnings, unrelatedTables: before.tables.size };
}
