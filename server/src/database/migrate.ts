/**
 * Guarded migration runner.
 *
 *   npm run db:migrate -- --schema public            (production tables)
 *   npm run db:migrate -- --schema website_with_rag_test   (isolated test schema)
 *   add --dry-run to only run the safety scan and print the plan
 *
 * Safety:
 *  - every migration file is statically scanned (sqlSafety.ts) before anything executes;
 *  - each file runs in its own transaction and is recorded with a checksum;
 *  - an applied file whose checksum changed is refused (write a new migration instead);
 *  - unrelated objects are snapshotted before and after and compared.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { env } from '../config/env.js';
import { connectionConfig } from './connection.js';
import { checkMigrationSql, PREFIX } from './sqlSafety.js';
import { compareSnapshots, takeSnapshot } from './snapshot.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'supabase');
const ALLOWED_SCHEMAS = new Set(['public', 'website_with_rag_test']);

export function renderSql(sql: string, schema: string, dims: number) {
  if (!ALLOWED_SCHEMAS.has(schema)) throw new Error(`Schema "${schema}" is not allowed`);
  return sql.replaceAll('{{schema}}', schema).replaceAll('{{embedding_dims}}', String(dims));
}

export function listMigrations() {
  const dir = join(ROOT, 'migrations');
  return readdirSync(dir)
    .filter((f) => /^\d{4}_[a-z0-9_]+\.sql$/.test(f))
    .sort()
    .map((file) => {
      const raw = readFileSync(join(dir, file), 'utf8');
      return { file, version: file.slice(0, 4), raw, checksum: createHash('sha256').update(raw).digest('hex') };
    });
}

export async function migrate({ schema, dryRun = false, log = console.log }: { schema: string; dryRun?: boolean; log?: (...a: unknown[]) => void }) {
  if (!ALLOWED_SCHEMAS.has(schema)) throw new Error(`Schema "${schema}" is not allowed`);
  const dims = env().EMBEDDING_DIMENSIONS;
  const migrations = listMigrations();
  const hardening = readFileSync(join(ROOT, 'policies', 'harden.sql'), 'utf8');

  for (const m of [...migrations, { file: 'policies/harden.sql', raw: hardening }]) {
    const report = checkMigrationSql(m.raw);
    if (!report.ok) throw new Error(`Safety check failed for ${m.file}:\n  - ${report.problems.join('\n  - ')}`);
  }
  log(`Safety scan passed for ${migrations.length} migration(s) + hardening.`);
  if (dryRun) {
    for (const m of migrations) log(`  would apply (if pending): ${m.file}`);
    return { applied: [] as string[] };
  }

  const client = new pg.Client(connectionConfig('migration'));
  await client.connect();
  const applied: string[] = [];
  try {
    const before = await takeSnapshot(client);

    if (schema !== 'public') {
      // Only the dedicated, prefixed test schema may be created. It is never exposed via the API.
      await client.query(`create schema if not exists ${schema}`);
      await client.query(`revoke all on schema ${schema} from public`);
      for (const role of ['anon', 'authenticated']) {
        const r = await client.query('select 1 from pg_roles where rolname = $1', [role]);
        if (r.rowCount) await client.query(`revoke all on schema ${schema} from ${role}`);
      }
    }

    await client.query(`
      create table if not exists ${schema}.${PREFIX}schema_migrations (
        version text primary key,
        file text not null,
        checksum text not null,
        applied_at timestamptz not null default now()
      )`);

    // Refuse to proceed if an existing embedding column was created with other dimensions.
    const dimRow = await client.query(
      `select a.atttypmod as dims from pg_attribute a join pg_class c on c.oid = a.attrelid
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1 and c.relname = $2 and a.attname = 'embedding' and not a.attisdropped`,
      [schema, `${PREFIX}knowledge_chunks`],
    );
    if (dimRow.rowCount && dimRow.rows[0].dims !== dims) {
      throw new Error(
        `EMBEDDING_DIMENSIONS (${dims}) does not match the existing embedding column (${dimRow.rows[0].dims}). ` +
          'Re-embedding requires a planned migration; nothing was changed.',
      );
    }

    const done = new Map(
      (await client.query(`select version, checksum from ${schema}.${PREFIX}schema_migrations`)).rows.map((r) => [
        r.version as string,
        r.checksum as string,
      ]),
    );

    for (const m of migrations) {
      const prior = done.get(m.version);
      if (prior) {
        if (prior !== m.checksum) {
          throw new Error(`${m.file} was already applied with different contents. Add a new migration instead.`);
        }
        continue;
      }
      await client.query('begin');
      try {
        await client.query(renderSql(m.raw, schema, dims));
        await client.query(
          `insert into ${schema}.${PREFIX}schema_migrations (version, file, checksum) values ($1, $2, $3)`,
          [m.version, m.file, m.checksum],
        );
        await client.query('commit');
        applied.push(m.file);
        log(`  applied ${m.file}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`Migration ${m.file} failed and was rolled back: ${(err as Error).message}`);
      }
    }

    await client.query('begin');
    await client.query(renderSql(hardening, schema, dims));
    await client.query('commit');
    log('  re-applied access hardening (RLS enabled, browser roles revoked)');

    const after = await takeSnapshot(client);
    const diff = compareSnapshots(before, after);
    if (diff.problems.length) {
      throw new Error(`Isolation check FAILED after migration:\n  - ${diff.problems.join('\n  - ')}`);
    }
    for (const w of diff.warnings) log(`  note: ${w}`);
    log(`Isolation check passed: ${diff.unrelatedTables} unrelated tables, functions and policies unchanged.`);
    return { applied };
  } finally {
    await client.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const schemaArg = args[args.indexOf('--schema') + 1];
  const schema = args.includes('--schema') ? schemaArg : env().DB_SCHEMA;
  migrate({ schema, dryRun: args.includes('--dry-run') })
    .then((r) => {
      console.log(r.applied.length ? `Done: ${r.applied.length} migration(s) applied.` : 'Done: schema already up to date.');
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}
