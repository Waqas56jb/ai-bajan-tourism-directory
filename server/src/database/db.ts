import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { connectionConfig } from './connection.js';

/**
 * Thin data-access layer over node-postgres. Every query is parameterised; table names come only
 * from the fixed TABLES map below (never from request input).
 */
export const TABLE_NAMES = [
  'admins',
  'users',
  'categories',
  'locations',
  'listings',
  'faqs',
  'knowledge_documents',
  'knowledge_chunks',
  'index_state',
  'sync_jobs',
  'conversations',
  'messages',
  'conversation_notes',
  'retrieval_logs',
  'feedback',
  'ads',
  'featured_listings',
  'audit_logs',
  'content_revisions',
  'settings',
  'error_events',
  'schema_migrations',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];

export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<pg.QueryResult<R>>;
}

export class Database {
  readonly schema: string;
  private readonly tables: Record<TableName, string>;

  constructor(
    readonly pool: pg.Pool,
    schema: string,
  ) {
    if (!/^(public|website_with_rag_test)$/.test(schema)) throw new Error('Invalid schema');
    this.schema = schema;
    this.tables = Object.fromEntries(TABLE_NAMES.map((t) => [t, `${schema}.website_with_rag_${t}`])) as Record<
      TableName,
      string
    >;
  }

  /** Fully qualified, prefixed table name. */
  t(name: TableName): string {
    return this.tables[name];
  }

  /** Fully qualified, prefixed function name. */
  fn(name: 'keyword_search' | 'vector_search' | 'claim_sync_jobs'): string {
    return `${this.schema}.website_with_rag_${name}`;
  }

  query<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]) {
    return this.pool.query<R>(text, values);
  }

  async one<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<R | null> {
    const r = await this.pool.query<R>(text, values);
    return r.rows[0] ?? null;
  }

  async many<R extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<R[]> {
    return (await this.pool.query<R>(text, values)).rows;
  }

  /** Run fn inside a transaction. The client is released whatever happens. */
  async tx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (err) {
      await client.query('rollback').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async ping(timeoutMs = 3000): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const started = performance.now();
    try {
      await Promise.race([
        this.pool.query('select 1'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ]);
      return { ok: true, latencyMs: Math.round(performance.now() - started) };
    } catch (err) {
      return { ok: false, latencyMs: Math.round(performance.now() - started), error: (err as Error).message === 'timeout' ? 'timeout' : 'unreachable' };
    }
  }

  close() {
    return this.pool.end();
  }
}

export function createDatabase(schema = env().DB_SCHEMA): Database {
  const pool = new pg.Pool(connectionConfig('app'));
  pool.on('error', (err) => logger.error({ err }, 'idle database client error'));
  return new Database(pool, schema);
}
