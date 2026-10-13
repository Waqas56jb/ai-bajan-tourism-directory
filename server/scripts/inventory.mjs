// Read-only database inventory. Runs inside a READ ONLY transaction so no write can occur.
// Usage: node scripts/inventory.mjs [outfile]
import 'dotenv/config';
import pg from 'pg';
import { writeFileSync, mkdirSync } from 'node:fs';

const PREFIX = 'website_with_rag_';
const client = new pg.Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_MIGRATION_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30000,
});

const q = async (sql, params) => (await client.query(sql, params)).rows;
// Optional probe: isolated in a savepoint so a missing schema doesn't abort the read-only transaction.
const probe = async (sql) => {
  await client.query('SAVEPOINT probe');
  try {
    const rows = await q(sql);
    await client.query('RELEASE SAVEPOINT probe');
    return rows;
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT probe');
    return `unavailable: ${e.code}`;
  }
};

await client.connect();
await client.query('BEGIN TRANSACTION READ ONLY');
try {
  const inv = {};
  inv.server = (await q(`select version(), current_user, current_database()`))[0];
  inv.schemas = await q(
    `select nspname as schema from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema' order by 1`,
  );
  inv.extensions = await q(
    `select e.extname, e.extversion, n.nspname as schema from pg_extension e join pg_namespace n on n.oid = e.extnamespace order by 1`,
  );
  inv.availableVector = await q(
    `select name, default_version, installed_version from pg_available_extensions where name = 'vector'`,
  );
  inv.tables = await q(`
    select n.nspname as schema, c.relname as table, c.relrowsecurity as rls,
           c.reltuples::bigint as est_rows
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema')
       and n.nspname not like 'pg_toast%'
     order by 1,2`);
  inv.views = await q(`
    select n.nspname as schema, c.relname as view from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where c.relkind in ('v','m') and n.nspname = 'public' order by 2`);
  inv.publicFunctions = await q(`
    select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' order by 1`);
  inv.publicTriggers = await q(`
    select c.relname as table, t.tgname as trigger from pg_trigger t join pg_class c on c.oid=t.tgrelid
      join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by 1,2`);
  inv.publicPolicies = await q(
    `select tablename, policyname, cmd, roles from pg_policies where schemaname='public' order by 1,2`,
  );
  inv.publicIndexCount = (
    await q(`select count(*)::int as n from pg_indexes where schemaname='public'`)
  )[0].n;
  inv.prefixedObjects = await q(
    `select n.nspname as schema, c.relname as name, c.relkind as kind
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relname like $1 order by 2`,
    [PREFIX + '%'],
  );
  inv.prefixedFunctions = await q(
    `select p.proname from pg_proc p where p.proname like $1`,
    [PREFIX + '%'],
  );
  inv.buckets = await probe(`select id, name, public from storage.buckets order by 1`);
  inv.migrationHistory = await probe(
    `select version, name from supabase_migrations.schema_migrations order by version desc limit 20`,
  );
  // Exact row counts for public tables (count(*) is read-only); used for before/after isolation checks.
  inv.publicRowCounts = {};
  for (const t of inv.tables.filter((t) => t.schema === 'public')) {
    const r = await q(`select count(*)::bigint as n from public.${client.escapeIdentifier(t.table)}`);
    inv.publicRowCounts[t.table] = Number(r[0].n);
  }
  const out = process.argv[2];
  if (out) {
    mkdirSync('inventory', { recursive: true });
    writeFileSync(out, JSON.stringify(inv, null, 2));
  }
  console.log(JSON.stringify(inv, null, 2));
} finally {
  await client.query('ROLLBACK');
  await client.end();
}
