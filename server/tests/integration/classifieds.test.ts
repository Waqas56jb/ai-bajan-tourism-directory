import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/app/context.js';
import type { JsonCompletionRequest } from '../../src/llm/provider.js';
import { SyncWorker } from '../../src/sync/syncWorker.js';
import { IDS } from '../fixtures/lexicon.js';
import { bearer, createTestContext, drainQueue, ensureTestSchema, fakeLlm, resetTestSchema, seedAdmins, seedDirectory } from './helpers.js';

let ctx: AppContext;
let app: Express;
const prompts: JsonCompletionRequest[] = [];
const llm = fakeLlm((req) => {
  prompts.push(req);
  const ids = [...req.messages[1].content.matchAll(/<source id="(S\d+)"/g)].map((m) => m[1]);
  return { answer: 'Answer from the sources.', source_ids: ids.slice(0, 2), needs_clarification: false, clarification_question: '' };
});

beforeAll(async () => {
  await ensureTestSchema();
  ({ ctx, app } = createTestContext(llm));
  await resetTestSchema(ctx.db);
  await seedAdmins(ctx.db);
  await seedDirectory(ctx.db);
  await drainQueue(ctx);
});
afterAll(async () => ctx.db.close());

const job = {
  kind: 'job',
  title: 'Experienced tyre technician',
  description: 'Full-time tyre technician for a busy south coast workshop. Puncture repairs, balancing and alignment.',
  category: 'Automotive',
  employer: 'Island Tyre Repair',
  employmentType: 'Full-time',
  salary: 'BBD 900 per fortnight',
  locationId: IDS.locOistins,
  contactName: 'Jordan Best',
  contactPhone: '+1 246 555 0171',
  consent: true,
};

describe('jobs & classifieds', () => {
  let jobId = '';

  it('accepts submissions as pending only, with validation', async () => {
    const post = (b: object) => request(app).post('/api/v1/public/classifieds').send(b);
    expect((await post({ ...job, consent: false })).status).toBe(422);
    expect((await post({ ...job, contactPhone: '' })).status).toBe(422);
    expect((await post({ ...job, employer: '' })).status).toBe(422);
    expect((await post({ ...job, status: 'approved' })).status).toBe(422);
    const res = await post(job);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
    jobId = res.body.id;
    expect((await request(app).get('/api/v1/public/classifieds')).body.items).toEqual([]);
  });

  it('admin approval publishes it with an expiry date and makes it answerable', async () => {
    expect((await request(app).patch(`/api/v1/admin/classifieds/${jobId}`).set(bearer('analyst')).send({ status: 'approved' })).status).toBe(403);
    const ok = await request(app).patch(`/api/v1/admin/classifieds/${jobId}`).set(bearer('moderator')).send({ status: 'approved' });
    expect(ok.status).toBe(200);
    const expected = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
    expect(String(ok.body.expiresAt).slice(0, 10)).toBe(expected);
    expect((await request(app).patch(`/api/v1/admin/classifieds/${jobId}`).set(bearer('moderator')).send({ expiresAt: '2000-01-01' })).status).toBe(400);

    const pub = await request(app).get('/api/v1/public/classifieds').query({ kind: 'job' });
    expect(pub.body.items.map((x: { title: string }) => x.title)).toEqual(['Experienced tyre technician']);
    expect(pub.body.items[0]).not.toHaveProperty('reviewNote');

    await drainQueue(ctx);
    const chat = await request(app).post('/api/v1/chat').send({ message: 'What jobs are available for a tyre technician?' });
    expect(chat.body.sources.map((s: { id: string }) => s.id)).toContain(jobId);
    expect(chat.body.sources.find((s: { id: string }) => s.id === jobId).url).toBe(`/classifieds?view=${jobId}`);
  });

  it('expired ads disappear from the public list and the assistant', async () => {
    await ctx.db.query(`update ${ctx.db.t('classifieds')} set expires_at = current_date - 1 where id = $1`, [jobId]);
    // Retrieval ignores it immediately, even before the worker runs.
    const chat = await request(app).post('/api/v1/chat').send({ message: 'What jobs are available for a tyre technician?' });
    expect(chat.body.sources.map((s: { id: string }) => s.id)).not.toContain(jobId);
    expect((await request(app).get('/api/v1/public/classifieds')).body.items).toEqual([]);
    const n = await new SyncWorker(ctx.db, llm, { leaseSeconds: 60 }).expireClassifieds();
    expect(n).toBe(1);
    await drainQueue(ctx);
    const row = await ctx.db.one<{ status: string }>(`select status from ${ctx.db.t('classifieds')} where id = $1`, [jobId]);
    expect(row!.status).toBe('expired');
    const chunks = await ctx.db.one<{ n: number }>(`select count(*)::int as n from ${ctx.db.t('knowledge_chunks')} where source_id = $1 and is_active`, [jobId]);
    expect(chunks!.n).toBe(0);
  });
});

describe('resident / visitor switch', () => {
  it('passes the audience to the model instructions', async () => {
    await request(app).post('/api/v1/chat').send({ message: 'Where can I find a pharmacy?', audience: 'resident' });
    expect(prompts.at(-1)!.messages[1].content).toMatch(/LIVES in Barbados/);
    await request(app).post('/api/v1/chat').send({ message: 'Where can I find a pharmacy?', audience: 'visitor' });
    expect(prompts.at(-1)!.messages[1].content).toMatch(/VISITING Barbados/);
    expect((await request(app).post('/api/v1/chat').send({ message: 'hi', audience: 'alien' })).status).toBe(422);
  });
});

describe('questions report', () => {
  it('ranks questions and lists poorly answered ones', async () => {
    for (let i = 0; i < 3; i++) await request(app).post('/api/v1/chat').send({ message: 'Find pharmacies.' });
    await request(app).post('/api/v1/chat').send({ message: 'Find Zanzibar Moon Bakery' });
    expect((await request(app).get('/api/v1/admin/analytics/questions').set(bearer('stranger'))).status).toBe(403);
    const r = await request(app).get('/api/v1/admin/analytics/questions').set(bearer('analyst')).query({ days: 7 });
    expect(r.status).toBe(200);
    expect(r.body.totals.questions).toBeGreaterThanOrEqual(4);
    expect(r.body.top.find((q: { question: string }) => q.question === 'find pharmacies').asked).toBeGreaterThanOrEqual(3);
    expect(r.body.poor.map((q: { question: string }) => q.question)).toContain('find zanzibar moon bakery');
  });
});
