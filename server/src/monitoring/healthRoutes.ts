import { Router } from 'express';
import type { AppContext } from '../app/context.js';

const REQUIRED_MIGRATIONS = ['0001', '0002', '0003', '0004'];

export function healthRoutes(ctx: AppContext) {
  const r = Router();

  /** Liveness: the process is running. No dependencies are touched. */
  r.get('/live', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  /**
   * Readiness: database reachable and schema migrated. The chatbot can serve answers without an
   * LLM (extractive mode), so a missing OpenAI key is reported as "degraded", not "not ready".
   */
  r.get('/ready', async (_req, res) => {
    const db = await ctx.db.ping();
    let schema: 'ok' | 'missing_migrations' | 'unknown' = 'unknown';
    if (db.ok) {
      try {
        const rows = await ctx.db.many<{ version: string }>(`select version from ${ctx.db.t('schema_migrations')}`);
        const have = new Set(rows.map((x) => x.version));
        schema = REQUIRED_MIGRATIONS.every((v) => have.has(v)) ? 'ok' : 'missing_migrations';
      } catch {
        schema = 'missing_migrations';
      }
    }
    const ready = db.ok && schema === 'ok';
    res.status(ready ? 200 : 503).json({
      status: ready ? (ctx.llm.available ? 'ready' : 'degraded') : 'not_ready',
      checks: {
        database: db.ok ? 'ok' : 'unreachable',
        schema,
        llm: ctx.llm.available ? 'configured' : 'not_configured (keyword retrieval + extractive answers only)',
      },
    });
  });

  return r;
}
