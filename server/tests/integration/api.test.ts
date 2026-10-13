import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/app/context.js';
import { IDS } from '../fixtures/lexicon.js';
import { bearer, createTestContext, drainQueue, ensureTestSchema, LISTINGS, noLlm, resetTestSchema, seedAdmins, seedDirectory } from './helpers.js';

let ctx: AppContext;
let app: Express;

beforeAll(async () => {
  await ensureTestSchema();
  ({ ctx, app } = createTestContext(noLlm()));
  await resetTestSchema(ctx.db);
  await seedAdmins(ctx.db);
  await seedDirectory(ctx.db);
  await drainQueue(ctx);
});
afterAll(async () => ctx.db.close());

const activeChunks = async (id: string) =>
  (await ctx.db.one<{ n: number }>(`select count(*)::int as n from ${ctx.db.t('knowledge_chunks')} where source_id = $1 and is_active`, [id]))!.n;

describe('health', () => {
  it('live and ready', async () => {
    expect((await request(app).get('/health/live')).body.status).toBe('ok');
    const ready = await request(app).get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.checks).toMatchObject({ database: 'ok', schema: 'ok' });
    expect(ready.body.status).toBe('degraded'); // no LLM key in this context
    expect(JSON.stringify(ready.body)).not.toMatch(/password|secret|key=/i);
  });
});

describe('authentication and authorization', () => {
  it('rejects missing, malformed and invalid tokens', async () => {
    expect((await request(app).get('/api/v1/admin/listings')).status).toBe(401);
    expect((await request(app).get('/api/v1/admin/listings').set('Authorization', 'Basic abc')).status).toBe(401);
    expect((await request(app).get('/api/v1/admin/listings').set('Authorization', 'Bearer not-a-real-token')).status).toBe(401);
  });
  it('a valid Supabase user who is not an AI Bajan admin is forbidden', async () => {
    const res = await request(app).get('/api/v1/admin/listings').set(bearer('stranger'));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
  it('a suspended admin is forbidden', async () => {
    expect((await request(app).get('/api/v1/admin/listings').set(bearer('suspended'))).status).toBe(403);
  });
  it('role permissions are enforced per operation', async () => {
    expect((await request(app).get('/api/v1/admin/listings').set(bearer('analyst'))).status).toBe(200);
    expect((await request(app).post('/api/v1/admin/listings').set(bearer('analyst')).send({ name: 'Nope' })).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/conversations').set(bearer('content'))).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/administrators').set(bearer('content'))).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/administrators').set(bearer('super'))).status).toBe(200);
  });
  it('/me reflects server-side identity; client role claims are ignored', async () => {
    const res = await request(app).get('/api/v1/admin/me').set(bearer('analyst')).set('X-Role', 'super_admin').query({ role: 'super_admin' });
    expect(res.body.role).toBe('analyst');
    expect(res.body.permissions).not.toContain('listings:write');
  });
  it('admins cannot change their own role', async () => {
    const me = await request(app).get('/api/v1/admin/me').set(bearer('super'));
    const res = await request(app).patch(`/api/v1/admin/administrators/${me.body.id}`).set(bearer('super')).send({ role: 'analyst' });
    expect(res.status).toBe(403);
  });
});

describe('listings', () => {
  let createdId = '';

  it('validates input strictly (unknown fields, bad URLs, missing name)', async () => {
    const unknown = await request(app).post('/api/v1/admin/listings').set(bearer('content')).send({ name: 'Test Place', is_admin: true });
    expect(unknown.status).toBe(422);
    const badUrl = await request(app).post('/api/v1/admin/listings').set(bearer('content')).send({ name: 'Test Place', contact: { website: 'javascript:alert(1)' } });
    expect(badUrl.status).toBe(422);
    expect(badUrl.body.error.details[0].field).toBe('contact.website');
    expect((await request(app).post('/api/v1/admin/listings').set(bearer('content')).send({})).status).toBe(422);
  });

  it('cannot publish on create (status limited to draft/pending)', async () => {
    const res = await request(app).post('/api/v1/admin/listings').set(bearer('content')).send({ name: 'Sneaky', status: 'published' });
    expect(res.status).toBe(422);
  });

  it('creates a listing, resolves the location path and audits it', async () => {
    const res = await request(app)
      .post('/api/v1/admin/listings')
      .set(bearer('content'))
      .send({
        name: 'Bathsheba Surf Shack',
        shortDescription: 'Surf lessons on the east coast.',
        categoryId: IDS.catTours,
        location: { cityId: IDS.locHoletown },
        contact: { phone: '+1 246 555 0177', website: 'https://example.com/surf' },
        details: { notes: 'private: owner prefers email', openingHours: [{ day: 'Daily', hours: '07:00 – 17:00' }] },
      });
    expect(res.status).toBe(201);
    createdId = res.body.id;
    expect(res.body.slug).toBe('bathsheba-surf-shack');
    expect(res.body.status).toBe('draft');
    expect(res.body.location).toMatchObject({ countryId: IDS.locBarbados, regionId: IDS.locStJames, cityId: IDS.locHoletown });
    const audit = await ctx.db.one(`select action from ${ctx.db.t('audit_logs')} where entity_id = $1`, [createdId]);
    expect(audit!.action).toBe('listing.created');
  });

  it('rejects inconsistent location ids', async () => {
    const res = await request(app).post('/api/v1/admin/listings').set(bearer('content')).send({ name: 'Mismatch', location: { regionId: IDS.locChristChurch, cityId: IDS.locHoletown } });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate slug', async () => {
    const res = await request(app).post('/api/v1/admin/listings').set(bearer('content')).send({ name: 'Other', slug: 'bathsheba-surf-shack' });
    expect(res.status).toBe(409);
  });

  it('auto-suffixes generated slugs', async () => {
    const res = await request(app).post('/api/v1/admin/listings').set(bearer('content')).send({ name: 'Bathsheba Surf Shack' });
    expect(res.body.slug).toBe('bathsheba-surf-shack-2');
    await request(app).delete(`/api/v1/admin/listings/${res.body.id}`).set(bearer('super'));
  });

  it('optimistic concurrency rejects stale updates', async () => {
    const ok = await request(app).patch(`/api/v1/admin/listings/${createdId}`).set(bearer('content')).send({ shortDescription: 'Surf lessons and board hire.', expectedVersion: 1 });
    expect(ok.status).toBe(200);
    expect(ok.body.version).toBe(2);
    const stale = await request(app).patch(`/api/v1/admin/listings/${createdId}`).set(bearer('content')).send({ shortDescription: 'x', expectedVersion: 1 });
    expect(stale.status).toBe(409);
  });

  it('a draft is never public or retrievable', async () => {
    await drainQueue(ctx);
    expect(await activeChunks(createdId)).toBe(0);
    expect((await request(app).get('/api/v1/public/listings/bathsheba-surf-shack')).status).toBe(404);
  });

  it('publishing requires listings:publish, then indexing makes it retrievable', async () => {
    expect((await request(app).post(`/api/v1/admin/listings/${createdId}/status`).set(bearer('analyst')).send({ status: 'published' })).status).toBe(403);
    const res = await request(app).post(`/api/v1/admin/listings/${createdId}/status`).set(bearer('moderator')).send({ status: 'published' });
    expect(res.status).toBe(200);
    const job = await ctx.db.one(`select status from ${ctx.db.t('sync_jobs')} where source_id = $1 order by created_at desc limit 1`, [createdId]);
    expect(job!.status).toBe('pending');
    await drainQueue(ctx);
    expect(await activeChunks(createdId)).toBeGreaterThan(0);
    const pub = await request(app).get('/api/v1/public/listings/bathsheba-surf-shack');
    expect(pub.status).toBe(200);
    expect(JSON.stringify(pub.body)).not.toContain('owner prefers email');
    expect(pub.body).not.toHaveProperty('details.notes');
    expect(pub.body).not.toHaveProperty('review');
  });

  it('private notes never reach the knowledge chunks', async () => {
    const rows = await ctx.db.many<{ chunk_text: string }>(`select chunk_text from ${ctx.db.t('knowledge_chunks')} where source_id = $1`, [createdId]);
    expect(rows.map((r) => r.chunk_text).join('\n')).not.toContain('owner prefers email');
  });

  it('unpublishing removes retrieval eligibility immediately (before the worker runs)', async () => {
    const res = await request(app).post(`/api/v1/admin/listings/${createdId}/status`).set(bearer('moderator')).send({ status: 'archived' });
    expect(res.status).toBe(200);
    expect(await activeChunks(createdId)).toBe(0);
    await drainQueue(ctx);
    const state = await ctx.db.one(`select status from ${ctx.db.t('index_state')} where source_id = $1`, [createdId]);
    expect(state!.status).toBe('excluded');
  });

  it('rejection requires a reason', async () => {
    expect((await request(app).post(`/api/v1/admin/listings/${createdId}/status`).set(bearer('moderator')).send({ status: 'rejected' })).status).toBe(422);
  });

  it('lists with filters, sorting and pagination bounds', async () => {
    const res = await request(app).get('/api/v1/admin/listings').set(bearer('analyst')).query({ status: 'published', categoryId: IDS.catPharmacies, sort: 'name', dir: 'asc' });
    expect(res.body.items.map((l: { name: string }) => l.name)).toEqual(['Harbour Lights Pharmacy', 'Westside Chemist']);
    expect((await request(app).get('/api/v1/admin/listings').set(bearer('analyst')).query({ pageSize: 101 })).status).toBe(422);
    expect((await request(app).get('/api/v1/admin/listings').set(bearer('analyst')).query({ page: 0 })).status).toBe(422);
    expect((await request(app).get('/api/v1/admin/listings').set(bearer('analyst')).query({ sort: 'password' })).status).toBe(422);
    const empty = await request(app).get('/api/v1/admin/listings').set(bearer('analyst')).query({ page: 999 });
    expect(empty.body.items).toEqual([]);
  });

  it('public listing search returns only published listings without private fields', async () => {
    const res = await request(app).get('/api/v1/public/listings').query({ category: 'pharmacies' });
    expect(res.body.items.map((l: { name: string }) => l.name).sort()).toEqual(['Harbour Lights Pharmacy', 'Westside Chemist']);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/wholesale buyer|private_notes|rejection|Southpoint|Old Mill/i);
  });

  it('missing records return 404 and invalid ids 422', async () => {
    expect((await request(app).get('/api/v1/admin/listings/00000000-0000-4000-8000-00000000ffff').set(bearer('analyst'))).status).toBe(404);
    expect((await request(app).get('/api/v1/admin/listings/not-a-uuid').set(bearer('analyst'))).status).toBe(422);
  });

  it('bulk actions are atomic and permission-checked', async () => {
    expect((await request(app).post('/api/v1/admin/listings/bulk').set(bearer('content')).send({ action: 'delete', ids: [LISTINGS.cityInn] })).status).toBe(403);
    const bad = await request(app)
      .post('/api/v1/admin/listings/bulk')
      .set(bearer('moderator'))
      .send({ action: 'archive', ids: [LISTINGS.cityInn, '00000000-0000-4000-8000-00000000ffff'] });
    expect(bad.status).toBe(404);
    const still = await ctx.db.one(`select status from ${ctx.db.t('listings')} where id = $1`, [LISTINGS.cityInn]);
    expect(still!.status).toBe('published'); // rolled back
  });

  it('deleting a listing removes its chunks after sync', async () => {
    const res = await request(app).delete(`/api/v1/admin/listings/${createdId}`).set(bearer('super'));
    expect(res.status).toBe(204);
    await drainQueue(ctx);
    const n = await ctx.db.one<{ n: number }>(`select count(*)::int as n from ${ctx.db.t('knowledge_chunks')} where source_id = $1`, [createdId]);
    expect(n!.n).toBe(0);
  });
});

describe('categories and locations', () => {
  it('refuses to delete a category in use, allows with reassignment', async () => {
    const created = await request(app).post('/api/v1/admin/categories').set(bearer('content')).send({ name: 'Chemists Temp' });
    expect(created.status).toBe(201);
    const tempId = created.body.id;
    await ctx.db.query(`update ${ctx.db.t('listings')} set primary_category_id = $1 where id = $2`, [tempId, LISTINGS.westsideChemist]);
    const refused = await request(app).delete(`/api/v1/admin/categories/${tempId}`).set(bearer('content'));
    expect(refused.status).toBe(409);
    expect(refused.body.error.details.listingCount).toBe(1);
    const ok = await request(app).delete(`/api/v1/admin/categories/${tempId}`).set(bearer('content')).query({ reassignTo: IDS.catPharmacies });
    expect(ok.status).toBe(204);
    const row = await ctx.db.one(`select primary_category_id from ${ctx.db.t('listings')} where id = $1`, [LISTINGS.westsideChemist]);
    expect(row!.primary_category_id).toBe(IDS.catPharmacies);
  });

  it('renaming a category queues re-indexing of its listings', async () => {
    const res = await request(app).patch(`/api/v1/admin/categories/${IDS.catPharmacies}`).set(bearer('content')).send({ synonyms: ['apothecaries'] });
    expect(res.status).toBe(200);
    const jobs = await ctx.db.one<{ n: number }>(`select count(*)::int as n from ${ctx.db.t('sync_jobs')} where status = 'pending' and source_type = 'listing'`);
    expect(jobs!.n).toBeGreaterThanOrEqual(2);
    await drainQueue(ctx);
  });

  it('prevents circular and invalid location hierarchies (database-enforced)', async () => {
    const cycle = await request(app).patch(`/api/v1/admin/locations/${IDS.locStJames}`).set(bearer('content')).send({ parentId: IDS.locHoletown });
    expect(cycle.status).toBe(400);
    const wrongType = await request(app).post('/api/v1/admin/locations').set(bearer('content')).send({ name: 'Speightstown', type: 'city', parentId: IDS.locBarbados });
    expect(wrongType.status).toBe(400);
    const orphan = await request(app).post('/api/v1/admin/locations').set(bearer('content')).send({ name: 'Nowhere', type: 'city' });
    expect(orphan.status).toBe(400);
  });

  it('refuses to delete a location that has children or listings', async () => {
    expect((await request(app).delete(`/api/v1/admin/locations/${IDS.locStJames}`).set(bearer('content'))).status).toBe(409);
    expect((await request(app).delete(`/api/v1/admin/locations/${IDS.locOistins}`).set(bearer('content'))).status).toBe(409);
  });

  it('public lookups return active values only', async () => {
    await ctx.db.query(`update ${ctx.db.t('categories')} set active = false where id = $1`, [IDS.catTours]);
    const res = await request(app).get('/api/v1/public/categories');
    expect(res.body.items.map((c: { slug: string }) => c.slug)).not.toContain('tours');
    await ctx.db.query(`update ${ctx.db.t('categories')} set active = true where id = $1`, [IDS.catTours]);
  });
});

describe('FAQs and documents', () => {
  it('content managers can draft; publishing requires knowledge:publish', async () => {
    const draft = await request(app).post('/api/v1/admin/faqs').set(bearer('content')).send({ question: 'Is tap water safe to drink?', answer: 'Yes, tap water in Barbados is generally safe.' });
    expect(draft.status).toBe(201);
    expect(draft.body.status).toBe('draft');
    const pub = await request(app).patch(`/api/v1/admin/faqs/${draft.body.id}`).set(bearer('content')).send({ status: 'published' });
    expect(pub.status).toBe(200);
    expect(pub.body.approvalStatus).toBe('approved');
    await drainQueue(ctx);
    expect(await activeChunks(draft.body.id)).toBe(1);
  });

  it('rejects empty FAQ answers', async () => {
    expect((await request(app).post('/api/v1/admin/faqs').set(bearer('content')).send({ question: 'Empty answer?', answer: ' ' })).status).toBe(422);
  });

  it('uploads text files, rejects unsupported types and duplicates', async () => {
    const up = await request(app).post('/api/v1/admin/knowledge/documents/upload').set(bearer('content')).field('title', 'Beach safety').attach('file', Buffer.from('# Rip currents\nSwim between the flags on the east coast.'), 'beach.md');
    expect(up.status).toBe(201);
    expect(up.body.file).toMatchObject({ name: 'beach.md', extractionStatus: 'extracted' });
    expect(up.body.status).toBe('draft');
    const dup = await request(app).post('/api/v1/admin/knowledge/documents/upload').set(bearer('content')).field('title', 'Beach safety').attach('file', Buffer.from('# Rip currents\nSwim between the flags on the east coast.'), 'copy.md');
    expect(dup.status).toBe(409);
    const pdf = await request(app).post('/api/v1/admin/knowledge/documents/upload').set(bearer('content')).attach('file', Buffer.from('%PDF-1.7 binary'), 'guide.pdf');
    expect(pdf.status).toBe(415);
    const disguised = await request(app).post('/api/v1/admin/knowledge/documents/upload').set(bearer('content')).attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]), 'image.txt');
    expect(disguised.status).toBe(415);
    const big = await request(app).post('/api/v1/admin/knowledge/documents/upload').set(bearer('content')).attach('file', Buffer.alloc(2 * 1024 * 1024 + 10, 97), 'big.txt');
    expect(big.status).toBe(413);
  });

  it('internal documents are never indexed even when published', async () => {
    const doc = await request(app).post('/api/v1/admin/knowledge/documents').set(bearer('super')).send({ title: 'Internal pricing', content: 'Commission rates are confidential.', visibility: 'internal', status: 'published' });
    expect(doc.status).toBe(201);
    await drainQueue(ctx);
    expect(await activeChunks(doc.body.id)).toBe(0);
  });

  it('chunk diagnostics expose text but never vectors', async () => {
    const res = await request(app).get(`/api/v1/admin/knowledge/documents/00000000-0000-4000-8000-000000000401/chunks`).set(bearer('analyst'));
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).not.toHaveProperty('embedding');
  });
});

describe('chat endpoint contract', () => {
  it('mints a visitor token and enforces conversation ownership', async () => {
    const first = await request(app).post('/api/v1/chat').send({ message: 'Find pharmacies' });
    expect(first.status).toBe(200);
    expect(first.body.visitorToken).toMatch(/^v1\./);
    const other = await request(app).post('/api/v1/chat/session');
    const res = await request(app).get(`/api/v1/chat/conversations/${first.body.conversationId}`).set('X-Visitor-Token', other.body.visitorToken);
    expect(res.status).toBe(404);
    const mine = await request(app).get(`/api/v1/chat/conversations/${first.body.conversationId}`).set('X-Visitor-Token', first.body.visitorToken);
    expect(mine.status).toBe(200);
    expect(mine.body.messages.length).toBe(2);
    const hijack = await request(app).post('/api/v1/chat').set('X-Visitor-Token', other.body.visitorToken).send({ message: 'hi', conversationId: first.body.conversationId });
    expect(hijack.status).toBe(404);
  });

  it('validates messages', async () => {
    expect((await request(app).post('/api/v1/chat').send({ message: '   ' })).status).toBe(422);
    expect((await request(app).post('/api/v1/chat').send({ message: 'x'.repeat(2001) })).status).toBe(422);
    expect((await request(app).post('/api/v1/chat').send({ message: 'hi', role: 'system' })).status).toBe(422);
    expect((await request(app).post('/api/v1/chat').send({ message: 'hi', language: 'xx' })).status).toBe(422);
    const malformed = await request(app).post('/api/v1/chat').set('Content-Type', 'application/json').send('{"message": ');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('MALFORMED_JSON');
  });

  it('a conversation id with an expired/missing session is refused', async () => {
    const res = await request(app).post('/api/v1/chat').send({ message: 'hi', conversationId: '00000000-0000-4000-8000-00000000abcd' });
    expect(res.status).toBe(400);
  });

  it('duplicate submissions (same clientMessageId) are idempotent', async () => {
    const first = await request(app).post('/api/v1/chat').send({ message: 'Find hotels', clientMessageId: 'retry-abc-123' });
    const again = await request(app)
      .post('/api/v1/chat')
      .set('X-Visitor-Token', first.body.visitorToken)
      .send({ message: 'Find hotels', clientMessageId: 'retry-abc-123', conversationId: first.body.conversationId });
    expect(again.body.messageId).toBe(first.body.messageId);
    const count = await ctx.db.one<{ n: number }>(`select count(*)::int as n from ${ctx.db.t('messages')} where conversation_id = $1`, [first.body.conversationId]);
    expect(count!.n).toBe(2);
  });
});

describe('feedback and conversations (admin)', () => {
  it('visitors can rate their own answers only', async () => {
    const chat = await request(app).post('/api/v1/chat').send({ message: 'Find pharmacies' });
    const ok = await request(app).post('/api/v1/feedback').set('X-Visitor-Token', chat.body.visitorToken).send({ type: 'answer_rating', helpful: false, messageId: chat.body.messageId });
    expect(ok.status).toBe(201);
    const other = await request(app).post('/api/v1/chat/session');
    const denied = await request(app).post('/api/v1/feedback').set('X-Visitor-Token', other.body.visitorToken).send({ type: 'answer_rating', helpful: true, messageId: chat.body.messageId });
    expect(denied.status).toBe(404);
    expect((await request(app).post('/api/v1/feedback').send({ type: 'incorrect_answer', message: '' })).status).toBe(422);
  });

  it('moderators review conversations; diagnostics are attached', async () => {
    const list = await request(app).get('/api/v1/admin/conversations').set(bearer('moderator'));
    expect(list.status).toBe(200);
    const id = list.body.items[0].id;
    const detail = await request(app).get(`/api/v1/admin/conversations/${id}`).set(bearer('moderator'));
    expect(detail.body.messages.length).toBeGreaterThan(0);
    expect(detail.body.diagnostics.length).toBeGreaterThan(0);
    expect((await request(app).post(`/api/v1/admin/conversations/${id}/review`).set(bearer('moderator')).send({ reviewStatus: 'flagged' })).status).toBe(200);
    expect((await request(app).post(`/api/v1/admin/conversations/${id}/notes`).set(bearer('moderator')).send({ note: 'Check pharmacy data' })).status).toBe(201);
    expect((await request(app).get(`/api/v1/admin/conversations/${id}/export`).set(bearer('moderator'))).status).toBe(403);
    expect((await request(app).get(`/api/v1/admin/conversations/${id}/export`).set(bearer('super'))).status).toBe(200);
  });

  it('feedback can be resolved with an audit trail', async () => {
    const list = await request(app).get('/api/v1/admin/feedback').set(bearer('moderator'));
    const id = list.body.items[0].id;
    const res = await request(app).patch(`/api/v1/admin/feedback/${id}`).set(bearer('moderator')).send({ status: 'resolved', note: 'Data checked' });
    expect(res.body.status).toBe('resolved');
    const log = await request(app).get('/api/v1/admin/activity').set(bearer('super')).query({ entityType: 'feedback' });
    expect(log.body.items[0].action).toBe('feedback.resolved');
    expect((await request(app).get('/api/v1/admin/activity').set(bearer('analyst'))).status).toBe(403);
  });
});

describe('advertising and featured listings', () => {
  it('validates dates, URLs and duplicate placements', async () => {
    expect((await request(app).post('/api/v1/admin/ads').set(bearer('super')).send({ title: 'Promo', placement: 'sidebar', startDate: '2026-11-10', endDate: '2026-11-01' })).status).toBe(422);
    expect((await request(app).post('/api/v1/admin/ads').set(bearer('super')).send({ title: 'Promo', placement: 'sidebar', startDate: '2026-11-01', endDate: '2026-11-10', targetUrl: 'ftp://x' })).status).toBe(422);
    const ad = await request(app).post('/api/v1/admin/ads').set(bearer('super')).send({ title: 'Promo', placement: 'sidebar', startDate: '2026-01-01', endDate: '2027-01-01', status: 'active', internalNotes: 'secret rate card' });
    expect(ad.status).toBe(201);
    const pub = await request(app).get('/api/v1/public/ads').query({ placement: 'sidebar' });
    expect(pub.body.items).toHaveLength(1);
    expect(JSON.stringify(pub.body)).not.toContain('secret rate card');

    const f = { listingId: LISTINGS.coralReef, placement: 'homepage', startDate: '2026-11-01', endDate: '2026-11-30' };
    expect((await request(app).post('/api/v1/admin/featured').set(bearer('super')).send(f)).status).toBe(201);
    expect((await request(app).post('/api/v1/admin/featured').set(bearer('super')).send({ ...f, startDate: '2026-11-15', endDate: '2026-12-15' })).status).toBe(409);
    expect((await request(app).post('/api/v1/admin/featured').set(bearer('super')).send({ ...f, listingId: LISTINGS.southpointDraft })).status).toBe(400);
  });
});

describe('ops endpoints', () => {
  it('dashboard metrics, sync summary, monitoring and settings', async () => {
    const dash = await request(app).get('/api/v1/admin/analytics/dashboard').set(bearer('analyst')).query({ days: 7 });
    expect(dash.status).toBe(200);
    expect(dash.body.daily).toHaveLength(7);
    expect(dash.body.listings.published).toBeGreaterThan(0);
    const sync = await request(app).get('/api/v1/admin/sync/summary').set(bearer('analyst'));
    expect(sync.body.embeddings).toMatch(/disabled/);
    const health = await request(app).get('/api/v1/admin/monitoring/health').set(bearer('super'));
    expect(health.body.services.database.status).toBe('up');
    expect(health.body.services.llm.status).toBe('not_configured');
    const bad = await request(app).put('/api/v1/admin/settings/chatbot').set(bearer('super')).send({ enabled: true });
    expect(bad.status).toBe(400);
    expect((await request(app).put('/api/v1/admin/settings/secrets').set(bearer('super')).send({})).status).toBe(422);
    const pubSettings = await request(app).get('/api/v1/public/settings/chatbot');
    expect(pubSettings.body.displayName).toBe('AI Bajan');
  });
});
