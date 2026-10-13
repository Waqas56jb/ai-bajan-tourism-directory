/**
 * Standalone sync worker process: `npm run worker` (dev) / `npm run worker:prod`.
 * Run one or more instances alongside the API; jobs are claimed safely with SKIP LOCKED + leases.
 */
import { ConfigError, env } from '../config/env.js';
import { createDatabase } from '../database/db.js';
import { OpenAiProvider } from '../llm/openaiProvider.js';
import { SyncWorker } from '../sync/syncWorker.js';
import { logger } from '../utils/logger.js';

let config;
try {
  config = env();
} catch (err) {
  console.error(err instanceof ConfigError ? err.message : 'Failed to load configuration');
  process.exit(1);
}

const db = createDatabase(config.DB_SCHEMA);
const llm = new OpenAiProvider();
const worker = new SyncWorker(db, llm, {
  leaseSeconds: config.WORKER_LEASE_SECONDS,
  retrievalLogDays: config.RETRIEVAL_LOG_RETENTION_DAYS,
  conversationDays: config.CONVERSATION_TTL_DAYS,
});

logger.info({ workerId: worker.workerId, embeddings: llm.available ? 'enabled' : 'disabled (keyword-only)' }, 'sync worker started');
const stop = () => {
  worker.stop();
  setTimeout(() => void db.close().finally(() => process.exit(0)), 1000);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
await worker.loop(config.WORKER_POLL_INTERVAL_MS);
