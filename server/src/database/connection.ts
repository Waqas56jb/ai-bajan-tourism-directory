import { readFileSync } from 'node:fs';
import pg from 'pg';
import { env } from '../config/env.js';

// Return NUMERIC/BIGINT counts as JS numbers (all our counts are well within safe-integer range).
pg.types.setTypeParser(20, (v) => Number(v));
// DATE columns stay as 'YYYY-MM-DD' strings instead of timezone-shifted Date objects.
pg.types.setTypeParser(1082, (v) => v);

function sslConfig(): pg.ConnectionConfig['ssl'] {
  const caFile = env().DATABASE_SSL_CA_FILE;
  // With the Supabase CA bundle configured the certificate chain is verified. Without it the
  // connection is still TLS-encrypted, but the server certificate is not pinned.
  if (caFile) return { ca: readFileSync(caFile, 'utf8'), rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

export function connectionConfig(kind: 'app' | 'migration'): pg.PoolConfig {
  const e = env();
  return {
    host: e.DATABASE_HOST,
    port: kind === 'migration' ? e.DATABASE_MIGRATION_PORT : e.DATABASE_PORT,
    database: e.DATABASE_NAME,
    user: e.DATABASE_USER,
    password: e.DATABASE_PASSWORD,
    ssl: sslConfig(),
    statement_timeout: kind === 'migration' ? 120000 : e.DATABASE_STATEMENT_TIMEOUT_MS,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: kind === 'migration' ? 1 : e.DATABASE_POOL_MAX,
    application_name: kind === 'migration' ? 'ai-bajan-migrate' : 'ai-bajan-api',
  };
}
