import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import type { Database } from '../database/db.js';
import type { LlmProvider } from '../llm/provider.js';
import { ProviderError, backoffDelay } from '../llm/retry.js';
import { logger, scrub } from '../utils/logger.js';
import { processIndexJob, type IndexJob } from './indexer.js';
import { afterSourceWrite } from './syncQueue.js';

interface ClaimedJob extends IndexJob {
  attempts: number;
  max_attempts: number;
}

export interface WorkerOptions {
  workerId?: string;
  leaseSeconds: number;
  batchSize?: number;
  retrievalLogDays?: number;
  conversationDays?: number;
}

const isTransient = (err: unknown) => {
  if (err instanceof ProviderError) return err.retryable;
  const code = (err as { code?: string })?.code ?? '';
  // Connection problems, timeouts, serialization/deadlock failures are worth retrying.
  return ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', '57014', '40001', '40P01', '08006', '08003', '53300'].includes(code) || /timeout|Index verification/i.test((err as Error)?.message ?? '');
};

/**
 * Durable, database-backed sync worker. Safe to run as several processes: jobs are claimed with
 * FOR UPDATE SKIP LOCKED and protected by a lease; an expired lease makes a job claimable again.
 */
export class SyncWorker {
  readonly workerId: string;
  private stopped = false;
  processed = 0;

  constructor(
    private readonly db: Database,
    private readonly llm: LlmProvider,
    private readonly opts: WorkerOptions,
  ) {
    this.workerId = opts.workerId ?? `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;
  }

  /** Claim and process one batch. Returns the number of jobs handled. */
  async runOnce(): Promise<number> {
    const jobs = await this.db.many<ClaimedJob>(`select * from ${this.db.fn('claim_sync_jobs')}($1, $2, $3)`, [
      this.workerId,
      this.opts.batchSize ?? 5,
      this.opts.leaseSeconds,
    ]);
    for (const job of jobs) {
      if (this.stopped) break;
      await this.handle(job);
    }
    return jobs.length;
  }

  private async handle(job: ClaimedJob) {
    const t = this.db.t('sync_jobs');
    try {
      const outcome = await processIndexJob(this.db, this.llm, job);
      // Only the lease holder may complete the job (a reclaimed job belongs to another worker).
      await this.db.query(
        `update ${t} set status = $3, result = $4, completed_at = now(), locked_by = null, lease_expires_at = null, last_error = ''
          where id = $1 and locked_by = $2 and status = 'running'`,
        [job.id, this.workerId, outcome.status, JSON.stringify(outcome.result)],
      );
      this.processed++;
      logger.info({ jobId: job.id, source: `${job.source_type}:${job.source_id}`, outcome: outcome.status, result: outcome.result }, 'sync job finished');
    } catch (err) {
      const message = scrub((err as Error)?.message ?? 'unknown error').slice(0, 500);
      const retry = isTransient(err) && job.attempts < job.max_attempts;
      logger.warn({ jobId: job.id, attempt: job.attempts, retry, err }, 'sync job failed');
      if (retry) {
        const delayMs = Math.max(5000, backoffDelay(job.attempts, 10000, 15 * 60 * 1000));
        try {
          await this.db.query(
            `update ${t} set status = 'pending', next_run_at = now() + make_interval(secs => $3), last_error = $4,
                    locked_by = null, lease_expires_at = null
              where id = $1 and locked_by = $2 and status = 'running'`,
            [job.id, this.workerId, delayMs / 1000, message],
          );
        } catch (e) {
          // A newer pending job for the same source already exists: it supersedes this one.
          if ((e as { code?: string }).code !== '23505') throw e;
          await this.db.query(`update ${t} set status = 'superseded', last_error = $2, completed_at = now() where id = $1`, [job.id, message]);
        }
      } else {
        await this.db.query(
          `update ${t} set status = 'failed', last_error = $3, completed_at = now(), locked_by = null, lease_expires_at = null
            where id = $1 and locked_by = $2 and status = 'running'`,
          [job.id, this.workerId, message],
        );
        await this.db.query(
          `insert into ${this.db.t('index_state')} (source_type, source_id, status, last_error) values ($1, $2, 'failed', $3)
           on conflict (source_type, source_id) do update set status = 'failed', last_error = $3, updated_at = now()`,
          [job.source_type, job.source_id, message],
        );
        await this.db.query(
          `insert into ${this.db.t('error_events')} (category, severity, code, message, route) values ('sync', 'error', $1, $2, $3)`,
          [err instanceof ProviderError ? err.kind : 'SYNC_FAILED', message, `${job.source_type}:${job.source_id}`],
        );
      }
    }
  }

  async heartbeat() {
    await this.db.query(
      `insert into ${this.db.t('settings')} (key, value, updated_at) values ('worker_heartbeat', $1, now())
       on conflict (key) do update set value = $1, updated_at = now()`,
      [JSON.stringify({ workerId: this.workerId, at: new Date().toISOString(), processed: this.processed, embeddings: this.llm.available ? 'enabled' : 'disabled' })],
    );
  }

  /** Purge data past its retention window (only AI Bajan tables). */
  /** Mark approved ads past their expiry date as expired and remove them from the assistant's knowledge. */
  async expireClassifieds() {
    const rows = await this.db.many<{ id: string; content_version: number }>(
      `update ${this.db.t('classifieds')} set status = 'expired', content_version = content_version + 1
        where status = 'approved' and expires_at < current_date returning id, content_version`,
    );
    for (const r of rows) {
      await afterSourceWrite(this.db, this.db, { sourceType: 'classified', sourceId: r.id, version: r.content_version, eligible: false });
    }
    return rows.length;
  }

  async purgeExpired(retrievalLogDays: number, conversationDays: number) {
    const logs = await this.db.query(`delete from ${this.db.t('retrieval_logs')} where created_at < now() - make_interval(days => $1)`, [retrievalLogDays]);
    const convs = await this.db.query(
      `delete from ${this.db.t('conversations')} where last_activity_at < now() - make_interval(days => $1) and review_status <> 'flagged'`,
      [conversationDays],
    );
    const expired = await this.expireClassifieds();
    return { retrievalLogs: logs.rowCount ?? 0, conversations: convs.rowCount ?? 0, classifiedsExpired: expired };
  }

  async loop(pollMs: number) {
    let lastPurge = 0;
    while (!this.stopped) {
      try {
        const n = await this.runOnce();
        await this.heartbeat();
        if (Date.now() - lastPurge > 60 * 60 * 1000) {
          lastPurge = Date.now();
          const purged = await this.purgeExpired(this.opts.retrievalLogDays ?? 30, this.opts.conversationDays ?? 30);
          if (purged.retrievalLogs || purged.conversations) logger.info(purged, 'retention purge');
        }
        if (n === 0) await new Promise((r) => setTimeout(r, pollMs));
      } catch (err) {
        logger.error({ err }, 'worker loop error');
        await new Promise((r) => setTimeout(r, Math.min(pollMs * 4, 60000)));
      }
    }
  }

  stop() {
    this.stopped = true;
  }
}
