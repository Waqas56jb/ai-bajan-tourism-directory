import { createApp } from './app.js';
import { createContext } from './app/createContext.js';
import { ConfigError, env } from './config/env.js';
import { SyncWorker } from './sync/syncWorker.js';
import { logger } from './utils/logger.js';

function main() {
  let config;
  try {
    config = env();
  } catch (err) {
    // Names the missing/invalid variables; never prints values.
    console.error(err instanceof ConfigError ? err.message : 'Failed to load configuration');
    process.exit(1);
  }

  const ctx = createContext();
  const app = createApp(ctx);
  const server = app.listen(config.PORT, () => {
    logger.info(
      { port: config.PORT, schema: config.DB_SCHEMA, llm: ctx.llm.available ? 'configured' : 'not configured (extractive answers, keyword-only indexing)' },
      'AI Bajan API listening',
    );
  });
  server.requestTimeout = 60_000;
  server.headersTimeout = 65_000;

  // Optional: run the sync worker inside the API process (fine for a single small instance).
  let worker: SyncWorker | null = null;
  if (config.RUN_WORKER_IN_PROCESS) {
    worker = new SyncWorker(ctx.db, ctx.llm, { leaseSeconds: config.WORKER_LEASE_SECONDS, retrievalLogDays: config.RETRIEVAL_LOG_RETENTION_DAYS, conversationDays: config.CONVERSATION_TTL_DAYS });
    void worker.loop(config.WORKER_POLL_INTERVAL_MS);
    logger.info({ workerId: worker.workerId }, 'in-process sync worker started');
  }

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    worker?.stop();
    server.close(() => {
      void ctx.db.close().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 15_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
