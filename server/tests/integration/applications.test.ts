import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/app/context.js';
import { IDS } from '../fixtures/lexicon.js';
import { bearer, createTestContext, drainQueue, ensureTestSchema, noLlm, resetTestSchema, seedAdmins, seedDirectory } from './helpers.js';

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

const business = {
  kind: 'business',
  plan: 'business_plus',
  registeredName: 'Island Tyre Services Ltd',
  tradingName: 'Island Tyre Repair',
  categoryId: IDS.catTours,
  description: 'Tyre repairs and replacements for cars and vans across the south coast.',
  productsServices: 'Puncture repairs, mobile service, wheel alignment, emergency assistance',
  address: '12 Main Road',
  locationId: IDS.locOistins,
  phone: '+1 246 555 0170',
  whatsapp: '+1 246 555 0170',
  email: 'tyres@example.com',
  website: 'https://example.com/tyres',
  openingHours: 'Mon-Sat 07:00-18:00',
  areasServed: 'Christ Church and St. Philip',
  priceRange: '$$',
  bookingPaymentDelivery: 'Walk-ins welcome; cash and card; mobile call-out available.',
  faqs: [{ question: 'Do you offer mobile tyre repair?', answer: 'Yes, across Christ Church and St. Philip.' }],
  mediaLinks: ['https://example.com/tyres/shop.jpg'],
  registrationNumber: 'BB-123456',
  contactName: 'Jordan Best',
  contactRole: 'Owner',
  contactEmail: 'jordan@example.com',
  contactPhone: '+1 246 555 0171',
  consentToUse: true,
  infoAccurate: true,
};

describe('business sign-up', () => {
  it('creates a pending listing, draft FAQs and an application — nothing is published', async () => {
    const res = await request(app).post('/api/v1/public/applications').send(business);
    expect(res.status).toBe(201);
    const appRow = await ctx.db.one<{ listing_id: string; plan: string; status: string }>(
      `select listing_id, plan, status from ${ctx.db.t('applications')} where id = $1`,
      [res.body.applicationId],
    );
    expect(appRow).toMatchObject({ plan: 'business_plus', status: 'new' });
    const listing = await ctx.db.one<{ status: string; name: string; city_id: string; region_id: string; private_notes: string; public_notes: string; info_confirmed_at: string }>(
      `select status, name, city_id, region_id, private_notes, public_notes, info_confirmed_at from ${ctx.db.t('listings')} where id = $1`,
      [appRow!.listing_id],
    );
    expect(listing).toMatchObject({ status: 'pending', name: 'Island Tyre Repair', city_id: IDS.locOistins, region_id: IDS.locChristChurch });
    expect(listing!.private_notes).toContain('BB-123456');
    expect(listing!.public_notes).toContain('Christ Church and St. Philip');
    expect(listing!.info_confirmed_at).toBeTruthy();
    const faqs = await ctx.db.many(`select status from ${ctx.db.t('faqs')} where related_listing_id = $1`, [appRow!.listing_id]);
    expect(faqs.map((f) => f.status)).toEqual(['draft']);
    expect((await request(app).get('/api/v1/public/listings').query({ q: 'tyre' })).body.items).toEqual([]);
  });

  it('requires consent, accuracy confirmation and valid fields', async () => {
    const post = (b: object) => request(app).post('/api/v1/public/applications').send(b);
    expect((await post({ ...business, consentToUse: false })).status).toBe(422);
    expect((await post({ ...business, infoAccurate: undefined })).status).toBe(422);
    expect((await post({ ...business, website: 'javascript:alert(1)' })).status).toBe(422);
    expect((await post({ ...business, plan: 'platinum' })).status).toBe(422);
    expect((await post({ ...business, status: 'published' })).status).toBe(422);
  });

  it('accepts content-provider applications without creating a listing', async () => {
    const res = await request(app).post('/api/v1/public/applications').send({
      kind: 'content_provider',
      organisationName: 'Barbados Heritage Society',
      contributorType: 'cultural',
      expertise: 'History of Bridgetown, chattel houses and Crop Over traditions.',
      website: 'https://example.com/heritage',
      qualifications: 'Registered charity; published heritage guides since 1998.',
      correctionsEmail: 'corrections@example.com',
      contactName: 'Dr. A. Clarke',
      contactEmail: 'aclarke@example.com',
      copyrightPermission: true,
      consentToUse: true,
    });
    expect(res.status).toBe(201);
    const row = await ctx.db.one<{ listing_id: string | null; plan: string }>(`select listing_id, plan from ${ctx.db.t('applications')} where id = $1`, [res.body.applicationId]);
    expect(row).toEqual({ listing_id: null, plan: 'contributor' });
  });

  it('admins review applications; verification shows on the public listing and in chatbot knowledge', async () => {
    expect((await request(app).get('/api/v1/admin/applications').set(bearer('stranger'))).status).toBe(403);
    const list = await request(app).get('/api/v1/admin/applications').set(bearer('analyst')).query({ kind: 'business' });
    expect(list.body.items[0].organisationName).toBe('Island Tyre Repair');
    const { id, listingId } = list.body.items[0];
    expect((await request(app).patch(`/api/v1/admin/applications/${id}`).set(bearer('analyst')).send({ status: 'approved' })).status).toBe(403);
    expect((await request(app).patch(`/api/v1/admin/applications/${id}`).set(bearer('moderator')).send({ status: 'approved', reviewNote: 'Checked registration' })).status).toBe(200);
    await request(app).post(`/api/v1/admin/listings/${listingId}/status`).set(bearer('moderator')).send({ status: 'published' });
    const v = await request(app).post(`/api/v1/admin/listings/${listingId}/verified`).set(bearer('moderator')).send({ verified: true });
    expect(v.body.verified).toBe(true);
    const pub = await request(app).get('/api/v1/public/listings/island-tyre-repair');
    expect(pub.body.isVerified).toBe(true);
    expect(JSON.stringify(pub.body)).not.toContain('BB-123456');
    await drainQueue(ctx);
    const chunk = await ctx.db.one<{ t: string }>(
      `select string_agg(chunk_text, ' ') as t from ${ctx.db.t('knowledge_chunks')} where source_id = $1 and is_active`,
      [listingId],
    );
    expect(chunk!.t).toContain('Verified by AI Bajan: yes');
    expect(chunk!.t).not.toContain('BB-123456');
  });
});
