import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/app/context.js';
import { processIndexJob } from '../../src/sync/indexer.js';
import { enqueueSync } from '../../src/sync/syncQueue.js';
import { SyncWorker } from '../../src/sync/syncWorker.js';
import { ProviderError } from '../../src/llm/retry.js';
import type { FakeProvider } from '../../src/llm/fakeProvider.js';
import { IDS } from '../fixtures/lexicon.js';
import { createTestContext, drainQueue, ensureTestSchema, fakeLlm, resetTestSchema, seedAdmins, seedDirectory, LISTINGS } from './helpers.js';

let ctx: AppContext;
let llm: FakeProvider;

// Seeded once; each test works on its own listing so tests stay independent.
beforeAll(async () => {
  await ensureTestSchema();
  llm = fakeLlm();
  ({ ctx } = createTestContext(llm));
  await resetTestSchema(ctx.db);
  await seedAdmins(ctx.db);
  await seedDirectory(ctx.db);
  await drainQueue(ctx);
});
afterAll(async () => ctx.db.close());
beforeEach(async () => {
  llm.failEmbeddings = null;
  await drainQueue(ctx);
});

const jobs = (id: string) =>
  ctx.db.many<{ id: string; status: string; attempts: number; source_version: number; last_error: string }>(
    `select id, status, attempts, source_version, last_error from ${ctx.db.t('sync_jobs')} where source_id = $1 order by created_at`,
    [id],
  );

describe('synchronisation queue', () => {
  it('repeated edits coalesce into one pending job carrying the newest version', async () => {
    for (let v = 2; v <= 5; v++) await enqueueSync(ctx.db, ctx.db, { sourceType: 'listing', sourceId: LISTINGS.snorkel, operation: 'upsert', version: v });
    const pending = (await jobs(LISTINGS.snorkel)).filter((j) => j.status === 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0].source_version).toBe(5);
  });

  it('a stale worker cannot overwrite newer content', async () => {
    // Version the worker "read" is older than what is in the database now.
    await ctx.db.query(`update ${ctx.db.t('listings')} set description = 'Now with a rooftop bar.', content_version = content_version + 1 where id = $1`, [LISTINGS.coralReef]);
    const realQuery = ctx.db.one.bind(ctx.db);
    let bumped = false;
    // Simulate a concurrent edit landing between "load source" and "write chunks".
    ctx.db.one = (async (sql: string, p?: unknown[]) => {
      if (!bumped && sql.includes('indexed_hash, status, embedding_model')) {
        bumped = true;
        await ctx.db.query(`update ${ctx.db.t('listings')} set content_version = content_version + 1 where id = $1`, [LISTINGS.coralReef]);
      }
      return realQuery(sql, p);
    }) as typeof ctx.db.one;
    try {
      const out = await processIndexJob(ctx.db, llm, { id: 'x', source_type: 'listing', source_id: LISTINGS.coralReef, operation: 'upsert', source_version: 2 });
      expect(out.status).toBe('superseded');
    } finally {
      ctx.db.one = realQuery;
    }
    const chunks = await ctx.db.many<{ text: string }>(`select chunk_text as text from ${ctx.db.t('knowledge_chunks')} where source_id = $1 and is_active`, [LISTINGS.coralReef]);
    expect(chunks.map((c) => c.text).join()).not.toContain('rooftop bar');
  });

  it('unchanged content is not re-embedded', async () => {
    const before = llm.calls.embed;
    await ctx.db.query(`update ${ctx.db.t('listings')} set private_notes = 'changed', content_version = content_version + 1 where id = $1`, [LISTINGS.fishFry]);
    const v = (await ctx.db.one<{ v: number }>(`select content_version as v from ${ctx.db.t('listings')} where id = $1`, [LISTINGS.fishFry]))!.v;
    await enqueueSync(ctx.db, ctx.db, { sourceType: 'listing', sourceId: LISTINGS.fishFry, operation: 'upsert', version: v });
    await drainQueue(ctx);
    expect(llm.calls.embed).toBe(before);
    const state = await ctx.db.one(`select indexed_version, status from ${ctx.db.t('index_state')} where source_id = $1`, [LISTINGS.fishFry]);
    expect(state).toMatchObject({ indexed_version: v, status: 'indexed' });
  });

  it('transient embedding failures retry with backoff, then fail visibly — never "completed"', async () => {
    llm.failEmbeddings = new ProviderError('rate_limited', '429', true);
    await ctx.db.query(`update ${ctx.db.t('listings')} set description = 'New text', content_version = content_version + 1 where id = $1`, [LISTINGS.westsideChemist]);
    await enqueueSync(ctx.db, ctx.db, { sourceType: 'listing', sourceId: LISTINGS.westsideChemist, operation: 'upsert', version: 99 });
    await ctx.db.query(`update ${ctx.db.t('sync_jobs')} set max_attempts = 2 where source_id = $1 and status = 'pending'`, [LISTINGS.westsideChemist]);
    const worker = new SyncWorker(ctx.db, llm, { leaseSeconds: 60, workerId: 'w1' });
    await worker.runOnce();
    let [job] = (await jobs(LISTINGS.westsideChemist)).filter((j) => j.status !== 'completed');
    expect(job.status).toBe('pending');
    expect(job.attempts).toBe(1);
    await ctx.db.query(`update ${ctx.db.t('sync_jobs')} set next_run_at = now() where id = $1`, [job.id]);
    await worker.runOnce();
    [job] = (await jobs(LISTINGS.westsideChemist)).filter((j) => j.id === job.id);
    expect(job.status).toBe('failed');
    expect(job.last_error).toMatch(/429/);
    const state = await ctx.db.one(`select status from ${ctx.db.t('index_state')} where source_id = $1`, [LISTINGS.westsideChemist]);
    expect(state!.status).toBe('failed');
    const err = await ctx.db.one(`select category, code from ${ctx.db.t('error_events')} order by created_at desc limit 1`);
    expect(err).toMatchObject({ category: 'sync', code: 'rate_limited' });
  });

  it('non-retryable failures fail immediately', async () => {
    llm.failEmbeddings = new ProviderError('auth', 'bad key', false);
    await ctx.db.query(`update ${ctx.db.t('listings')} set description = 'Changed again', content_version = content_version + 1 where id = $1`, [LISTINGS.cityInn]);
    await enqueueSync(ctx.db, ctx.db, { sourceType: 'listing', sourceId: LISTINGS.cityInn, operation: 'upsert', version: 2 });
    await new SyncWorker(ctx.db, llm, { leaseSeconds: 60 }).runOnce();
    const j = (await jobs(LISTINGS.cityInn)).at(-1)!;
    expect(j.status).toBe('failed');
    expect(j.attempts).toBe(1);
  });

  it('a deleted source has its chunks removed', async () => {
    await ctx.db.query(`delete from ${ctx.db.t('listings')} where id = $1`, [LISTINGS.greenLeaf]);
    await enqueueSync(ctx.db, ctx.db, { sourceType: 'listing', sourceId: LISTINGS.greenLeaf, operation: 'delete', version: 9 });
    await drainQueue(ctx);
    const n = await ctx.db.one<{ n: number }>(`select count(*)::int as n from ${ctx.db.t('knowledge_chunks')} where source_id = $1`, [LISTINGS.greenLeaf]);
    expect(n!.n).toBe(0);
    const state = await ctx.db.one(`select status from ${ctx.db.t('index_state')} where source_id = $1`, [LISTINGS.greenLeaf]);
    expect(state!.status).toBe('removed');
  });

  it('chunks carry category and location metadata including ancestors', async () => {
    const row = await ctx.db.one<{ category_ids: string[]; location_ids: string[] }>(
      `select category_ids, location_ids from ${ctx.db.t('knowledge_chunks')} where source_id = $1 limit 1`,
      [LISTINGS.harbourPharmacy],
    );
    expect(row!.category_ids).toContain(IDS.catPharmacies);
    expect(row!.location_ids).toEqual(expect.arrayContaining([IDS.locBarbados, IDS.locStMichael, IDS.locBridgetown]));
  });
  it('two workers never process the same job (SKIP LOCKED) and expired leases are reclaimed', async () => {
    for (const id of [LISTINGS.coralReef, LISTINGS.cityInn, LISTINGS.fishFry]) await enqueueSync(ctx.db, ctx.db, { sourceType: 'listing', sourceId: id, operation: 'upsert', version: 1 });
    const [a, b] = await Promise.all([
      ctx.db.many<{ id: string }>(`select id from ${ctx.db.fn('claim_sync_jobs')}('A', 2, 60)`),
      ctx.db.many<{ id: string }>(`select id from ${ctx.db.fn('claim_sync_jobs')}('B', 2, 60)`),
    ]);
    const all = [...a, ...b].map((r) => r.id);
    expect(new Set(all).size).toBe(all.length);
    expect(all.length).toBe(3);
    // Expire one lease: it becomes claimable again with an incremented attempt counter.
    await ctx.db.query(`update ${ctx.db.t('sync_jobs')} set lease_expires_at = now() - interval '1 second' where id = $1`, [all[0]]);
    const again = await ctx.db.many<{ id: string; attempts: number; locked_by: string }>(`select id, attempts, locked_by from ${ctx.db.fn('claim_sync_jobs')}('C', 5, 60)`);
    expect(again.map((r) => r.id)).toEqual([all[0]]);
    expect(again[0].attempts).toBe(2);
    expect(again[0].locked_by).toBe('C');
  });

});
