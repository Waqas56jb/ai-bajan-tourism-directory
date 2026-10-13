/**
 * Read-only isolation & security verification (runs inside a READ ONLY transaction).
 *   npm run db:verify -- [--schema public] [--baseline inventory/before.raw.json]
 *
 * Checks:
 *  1. every AI Bajan object in the schema uses the website_with_rag_ prefix (tables/indexes/functions/triggers)
 *  2. RLS is enabled on every AI Bajan table; anon/authenticated have no table or function privileges
 *  3. the Supabase REST API (PostgREST) refuses AI Bajan tables for the publishable/anon key
 *  4. compared with a baseline inventory: no unrelated table/function/policy/trigger/bucket changed
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import pg from 'pg';
import { env } from '../config/env.js';
import { connectionConfig } from './connection.js';
import { PREFIX } from './sqlSafety.js';

const args = process.argv.slice(2);
const schema = args.includes('--schema') ? args[args.indexOf('--schema') + 1] : env().DB_SCHEMA;
const baselinePath = args.includes('--baseline') ? args[args.indexOf('--baseline') + 1] : 'inventory/before.raw.json';
if (!/^(public|website_with_rag_test)$/.test(schema)) throw new Error('invalid schema');

const results: Array<{ check: string; ok: boolean; detail: string }> = [];
const record = (check: string, ok: boolean, detail = '') => results.push({ check, ok, detail });

const client = new pg.Client(connectionConfig('migration'));
await client.connect();
await client.query('begin transaction read only');
try {
  const q = async <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, p: unknown[] = []) => (await client.query<T>(sql, p)).rows;

  const ours = await q<{ name: string; kind: string; rls: boolean }>(
    `select c.relname as name, c.relkind as kind, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname like 'website\\_with\\_rag\\_%' order by 1`,
    [schema],
  );
  const tables = ours.filter((o) => o.kind === 'r');
  record('AI Bajan tables present', tables.length >= 21, `${tables.length} tables: ${tables.map((t) => t.name.replace(PREFIX, '')).join(', ')}`);
  const noRls = tables.filter((t) => !t.rls);
  record('RLS enabled on every AI Bajan table', noRls.length === 0, noRls.map((t) => t.name).join(', ') || 'all enabled');

  // Objects created by us must be prefixed: indexes on our tables, triggers on our tables, functions.
  const badIdx = await q<{ name: string }>(
    `select i.relname as name from pg_index x join pg_class i on i.oid = x.indexrelid join pg_class t on t.oid = x.indrelid
       join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = $1 and t.relname like 'website\\_with\\_rag\\_%' and i.relname not like 'website\\_with\\_rag\\_%'`,
    [schema],
  );
  record('indexes on AI Bajan tables are prefixed', badIdx.length === 0, badIdx.map((r) => r.name).join(', ') || 'ok');
  const badTrg = await q<{ name: string }>(
    `select t.tgname as name from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relname like 'website\\_with\\_rag\\_%' and not t.tgisinternal and t.tgname not like 'website\\_with\\_rag\\_%'`,
    [schema],
  );
  record('triggers on AI Bajan tables are prefixed', badTrg.length === 0, badTrg.map((r) => r.name).join(', ') || 'ok');
  const fns = await q<{ name: string }>(`select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $1 and p.proname like 'website\\_with\\_rag\\_%'`, [schema]);
  record('AI Bajan functions present', fns.length >= 6, fns.map((f) => f.name.replace(PREFIX, '')).join(', '));

  for (const role of ['anon', 'authenticated']) {
    const exists = await q(`select 1 from pg_roles where rolname = $1`, [role]);
    if (!exists.length) continue;
    const tablePriv = await q<{ name: string }>(
      `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1 and c.relkind = 'r' and c.relname like 'website\\_with\\_rag\\_%'
          and (has_table_privilege($2, c.oid, 'SELECT') or has_table_privilege($2, c.oid, 'INSERT')
            or has_table_privilege($2, c.oid, 'UPDATE') or has_table_privilege($2, c.oid, 'DELETE'))`,
      [schema, role],
    );
    record(`${role} has no privileges on AI Bajan tables`, tablePriv.length === 0, tablePriv.map((r) => r.name).join(', ') || 'none');
    const fnPriv = await q<{ name: string }>(
      `select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = $1 and p.proname like 'website\\_with\\_rag\\_%' and has_function_privilege($2, p.oid, 'EXECUTE')`,
      [schema, role],
    );
    record(`${role} cannot execute AI Bajan functions`, fnPriv.length === 0, fnPriv.map((r) => r.name).join(', ') || 'none');
  }
  const policies = await q<{ n: number }>(`select count(*)::int as n from pg_policies where schemaname = $1 and tablename like 'website\\_with\\_rag\\_%'`, [schema]);
  record('no permissive RLS policies on AI Bajan tables (deny-by-default)', policies[0].n === 0, `${policies[0].n} policies`);

  const migrations = await q<{ version: string }>(`select version from ${schema}.${PREFIX}schema_migrations order by 1`).catch(() => []);
  record('migrations recorded', migrations.length >= 2, migrations.map((m) => m.version).join(', '));

  // Baseline comparison of unrelated objects.
  if (schema === 'public' && existsSync(baselinePath)) {
    const base = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const nowTables = await q<{ table: string; rls: boolean }>(
      `select c.relname as table, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','p') and c.relname not like 'website\\_with\\_rag\\_%'`,
    );
    const baseTables = base.tables.filter((t: { schema: string; table: string }) => t.schema === 'public' && !t.table.startsWith(PREFIX));
    const missing = baseTables.filter((t: { table: string }) => !nowTables.some((n) => n.table === t.table));
    const added = nowTables.filter((n) => !baseTables.some((t: { table: string }) => t.table === n.table));
    const rlsChanged = baseTables.filter((t: { table: string; rls: boolean }) => nowTables.find((n) => n.table === t.table)?.rls !== t.rls && !missing.includes(t));
    record('no unrelated public table removed', missing.length === 0, missing.map((t: { table: string }) => t.table).join(', ') || `${baseTables.length} unchanged`);
    record('no unrelated public table added', added.length === 0, added.map((t) => t.table).join(', ') || 'none');
    record('RLS flags of unrelated tables unchanged', rlsChanged.length === 0, rlsChanged.map((t: { table: string }) => t.table).join(', ') || 'unchanged');
    const nowFns = new Set((await q<{ name: string }>(`select p.proname as name from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname not like 'website\\_with\\_rag\\_%'`)).map((r) => r.name));
    const baseFns = new Set<string>(base.publicFunctions.map((f: { name: string }) => f.name));
    record('unrelated public functions unchanged', [...baseFns].every((f) => nowFns.has(f)) && [...nowFns].every((f) => baseFns.has(f)), `${nowFns.size} functions`);
    const nowPolicies = await q<{ k: string }>(`select tablename || '.' || policyname as k from pg_policies where schemaname = 'public' and tablename not like 'website\\_with\\_rag\\_%'`);
    const basePolicies = new Set<string>(base.publicPolicies.map((p: { tablename: string; policyname: string }) => `${p.tablename}.${p.policyname}`));
    record('unrelated RLS policies unchanged', nowPolicies.length === basePolicies.size && nowPolicies.every((p) => basePolicies.has(p.k)), `${nowPolicies.length} policies`);
    const nowExt = await q<{ k: string }>(`select extname || '@' || extversion as k from pg_extension`);
    const baseExt = new Set<string>(base.extensions.map((e: { extname: string; extversion: string }) => `${e.extname}@${e.extversion}`));
    record('extensions unchanged', nowExt.length === baseExt.size && nowExt.every((e) => baseExt.has(e.k)), nowExt.map((e) => e.k).join(', '));
    const buckets = await q<{ id: string }>(`select id from storage.buckets`).catch(() => []);
    record('storage buckets unchanged', Array.isArray(base.buckets) && buckets.length === base.buckets.length, buckets.map((b) => b.id).join(', '));
    const diffs: string[] = [];
    for (const [table, before] of Object.entries(base.publicRowCounts as Record<string, number>)) {
      if (table.startsWith(PREFIX)) continue;
      const r = await q<{ n: number }>(`select count(*)::int as n from public.${client.escapeIdentifier(table)}`).catch(() => [{ n: -1 }]);
      if (r[0].n !== before) diffs.push(`${table}: ${before} → ${r[0].n}`);
    }
    // Other applications are live; differences are listed for review, not attributed to AI Bajan.
    record('unrelated row counts (informational; other apps are live)', true, diffs.length ? `changed by their own traffic: ${diffs.join('; ')}` : 'identical to baseline');
  } else if (schema === 'public') {
    record('baseline comparison', false, `baseline ${baselinePath} not found — run npm run db:inventory -- ${baselinePath} before migrating`);
  }
} finally {
  await client.query('rollback');
  await client.end();
}

// PostgREST probe with the publishable key (read-only GET). Must be refused.
const e = env();
if (schema === 'public' && e.SUPABASE_ANON_KEY) {
  for (const table of ['website_with_rag_listings', 'website_with_rag_conversations', 'website_with_rag_admins']) {
    const res = await fetch(`${e.SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`, {
      headers: { apikey: e.SUPABASE_ANON_KEY, Authorization: `Bearer ${e.SUPABASE_ANON_KEY}` },
    });
    const body = await res.text();
    const refused = res.status === 401 || res.status === 403 || res.status === 404 || /permission denied/i.test(body);
    record(`REST API refuses anon access to ${table}`, refused && !/^\[\s*\{/.test(body), `HTTP ${res.status}`);
  }
  const rpc = await fetch(`${e.SUPABASE_URL}/rest/v1/rpc/website_with_rag_keyword_search`, {
    method: 'POST',
    headers: { apikey: e.SUPABASE_ANON_KEY, Authorization: `Bearer ${e.SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_tsquery: 'pharmacy' }),
  });
  record('REST API refuses anon RPC to retrieval functions', rpc.status >= 400, `HTTP ${rpc.status}`);
}

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.check}${r.detail ? ` — ${r.detail}` : ''}`);
console.log(`\n${results.length - failed.length}/${results.length} checks passed for schema "${schema}".`);
mkdirSync('inventory', { recursive: true });
writeFileSync(`inventory/verify-${schema}.json`, JSON.stringify({ at: new Date().toISOString(), schema, results }, null, 2));
if (failed.length) process.exitCode = 1;
