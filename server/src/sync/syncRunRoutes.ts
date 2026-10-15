import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { AppContext } from '../app/context.js';
import { requirePermission } from '../middleware/auth.js';
import { forbidden, unauthorized } from '../utils/errors.js';
import { checkDueSources } from '../knowledge/sourceChecker.js';
import { SyncWorker } from './syncWorker.js';

/**
 * Serverless hosts (Vercel) have no long-running worker process, so the queue is drained by
 * short, time-boxed runs: a cron call and an admin "process now" button. Both are safe to run
 * concurrently with each other or with a dedicated worker (SKIP LOCKED + leases).
 */
async function drain(ctx: AppContext, budgetMs: number) {
  const worker = new SyncWorker(ctx.db, ctx.llm, {
    leaseSeconds: ctx.config.WORKER_LEASE_SECONDS,
    batchSize: 5,
    retrievalLogDays: ctx.config.RETRIEVAL_LOG_RETENTION_DAYS,
    conversationDays: ctx.config.CONVERSATION_TTL_DAYS,
  });
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < budgetMs) {
    const n = await worker.runOnce();
    processed += n;
    if (!n) break;
  }
  await worker.expireClassifieds();
  await worker.heartbeat();
  const remaining = await ctx.db.one<{ n: number }>(`select count(*)::int as n from ${ctx.db.t('sync_jobs')} where status = 'pending'`);
  return { worker, processed, remainingPending: remaining?.n ?? 0, ms: Date.now() - started };
}

function requireCronSecret(ctx: AppContext, authorization: string | undefined) {
  const secret = ctx.config.CRON_SECRET;
  if (!secret) throw forbidden('CRON_SECRET is not configured.');
  const given = Buffer.from((authorization ?? '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw unauthorized();
}

/** Vercel Cron only (Bearer CRON_SECRET): GET /internal/sync/run and GET /internal/sources/check. */
export function internalSyncRoutes(ctx: AppContext) {
  const r = Router();
  r.get('/sync/run', async (req, res) => {
    requireCronSecret(ctx, req.header('authorization'));
    const out = await drain(ctx, 45_000);
    const purged = await out.worker.purgeExpired(ctx.config.RETRIEVAL_LOG_RETENTION_DAYS, ctx.config.CONVERSATION_TTL_DAYS);
    res.json({ processed: out.processed, remainingPending: out.remainingPending, purged, ms: out.ms });
  });
  // Daily check for changes on imported web pages (oldest-checked first); changed pages are
  // re-indexed by the next sync run. Browser-built sites are re-checked by the crawler script.
  r.get('/sources/check', async (req, res) => {
    requireCronSecret(ctx, req.header('authorization'));
    res.json(await checkDueSources(ctx.db, { limit: 60, budgetMs: 45_000 }));
  });
  return r;
}

/** POST /api/v1/admin/sources/check — check imported web pages for changes now. */
export function adminSourceCheckRoutes(ctx: AppContext) {
  const r = Router();
  r.post('/check', requirePermission('sync:manage'), async (_req, res) => {
    res.json(await checkDueSources(ctx.db, { limit: 40, budgetMs: 40_000 }));
  });
  return r;
}

/** POST /api/v1/admin/sync/run — admins trigger indexing right after publishing. */
export function adminSyncRunRoutes(ctx: AppContext) {
  const r = Router();
  r.post('/run', requirePermission('sync:manage'), async (_req, res) => {
    const out = await drain(ctx, 40_000);
    res.json({ processed: out.processed, remainingPending: out.remainingPending, ms: out.ms });
  });
  return r;
}
