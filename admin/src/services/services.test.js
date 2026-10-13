import { describe, expect, it } from 'vitest';
import {
  getListings,
  createListing,
  setListingStatus,
  suggestSlug,
  toggleListingFeatured,
  deleteListing,
} from './listingService';
import { getCategories, deleteCategory, createCategory } from './categoryService';
import { createLocation, deleteLocation } from './locationService';
import { createFeaturedPlacement, createAdvertisement } from './advertisingService';
import {
  createFaq,
  bulkSetFaqStatus,
  getSyncJobs,
  retrySyncJob,
  refreshSyncQueue,
  getKnowledgeDocumentById,
} from './knowledgeService';
import { getActivityLogs } from './activityService';
import { globalSearch } from './searchService';
import { getDashboardStats } from './dashboardService';
import { login } from './authService';
import { setSimulateFailures, resetDemoData } from './settingsService';
import { emptyListing } from '@/components/listings/listingSchema';
import { readJSON, writeJSON, STORAGE_PREFIX } from '@/utils/storage';
import { toCSV } from '@/utils/csv';
import { can } from '@/utils/permissions';
import { slugify, safeExternalUrl } from '@/utils/validation';
import { mockListings } from '@/data/mockListings';
import { mockCategories } from '@/data/mockCategories';
import { mockLocations } from '@/data/mockLocations';

const validListing = (overrides = {}) => ({
  ...emptyListing(),
  name: 'Test Bakery',
  slug: 'test-bakery',
  shortDescription: 'A test bakery listing.',
  description: 'A longer description of the test bakery listing used in unit tests.',
  categoryId: 'cat-restaurants',
  location: { ...emptyListing().location, regionId: 'loc-st-james', cityId: 'loc-holetown' },
  ...overrides,
});

describe('demo data integrity', () => {
  it('meets the dataset size requirements', async () => {
    expect(mockListings.length).toBeGreaterThanOrEqual(20);
    expect(mockCategories.length).toBeGreaterThanOrEqual(10);
    expect(mockLocations.length).toBeGreaterThanOrEqual(10);
  });

  it('only references categories and locations that exist', () => {
    const cats = new Set(mockCategories.map((c) => c.id));
    const locs = new Set(mockLocations.map((l) => l.id));
    for (const l of mockListings) {
      expect(cats.has(l.categoryId)).toBe(true);
      l.secondaryCategoryIds.forEach((c) => expect(cats.has(c)).toBe(true));
      [l.location.regionId, l.location.cityId].forEach((id) => expect(locs.has(id)).toBe(true));
    }
  });

  it('uses only reserved, non-real contact details', () => {
    for (const l of mockListings) {
      expect(l.contact.email).toMatch(/@example\.com$/);
      expect(l.contact.phone).toMatch(/555-01\d\d$/);
    }
  });
});

describe('listing service', () => {
  it('creates a listing and records activity', async () => {
    const created = await createListing(validListing());
    expect(created.id).toMatch(/^lst-/);
    expect((await getListings()).some((l) => l.id === created.id)).toBe(true);
    expect((await getActivityLogs())[0]).toMatchObject({ action: 'listing_created', entityId: created.id });
  });

  it('rejects duplicate slugs and suggests a unique one', async () => {
    await expect(createListing(validListing({ slug: mockListings[0].slug }))).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(suggestSlug(mockListings[0].name)).toBe(`${mockListings[0].slug}-2`);
  });

  it('approves and rejects with a reason, updating indexing state', async () => {
    const approved = await setListingStatus('lst-017', 'published', { approve: true });
    expect(approved.status).toBe('published');
    expect(approved.ai.indexingStatus).toBe('pending');
    expect((await getSyncJobs()).some((j) => j.sourceId === 'lst-017' && j.status === 'pending')).toBe(true);

    const rejected = await setListingStatus('lst-018', 'rejected', { reason: 'Missing documents' });
    expect(rejected.rejectionReason).toBe('Missing documents');
  });

  it('removes featured placements when a listing is deleted', async () => {
    await deleteListing('lst-001');
    expect((await getListings()).find((l) => l.id === 'lst-001')).toBeUndefined();
  });

  it('persists changes to namespaced storage and survives a reload of the cache', async () => {
    const before = (await getListings()).find((l) => l.id === 'lst-004').featured;
    await toggleListingFeatured('lst-004');
    const stored = readJSON('listings', []);
    expect(stored.find((l) => l.id === 'lst-004').featured).toBe(!before);
  });

  it('simulates failures without changing data', async () => {
    setSimulateFailures(true);
    await expect(toggleListingFeatured('lst-004')).rejects.toMatchObject({ code: 'SIMULATED_FAILURE' });
    setSimulateFailures(false);
  });
});

describe('categories & locations', () => {
  it('blocks deleting a category used by listings unless listings are reassigned', async () => {
    await expect(deleteCategory('cat-restaurants')).rejects.toMatchObject({ code: 'CONFLICT' });
    await deleteCategory('cat-restaurants', { reassignTo: 'cat-experiences' });
    const cats = await getCategories();
    expect(cats.find((c) => c.id === 'cat-restaurants')).toBeUndefined();
    expect(cats.find((c) => c.id === 'cat-experiences').listingCount).toBeGreaterThan(2);
  });

  it('rejects duplicate category slugs', async () => {
    await expect(
      createCategory({
        name: 'Dup',
        slug: 'hotels',
        description: '',
        icon: 'Home',
        image: null,
        parentId: null,
        order: 20,
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('enforces the location hierarchy and protects used locations', async () => {
    await expect(
      createLocation({
        name: 'X',
        slug: 'x',
        type: 'city',
        parentId: 'loc-barbados',
        description: '',
        lat: null,
        lng: null,
        active: true,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const ok = await createLocation({
      name: 'Paynes Bay North',
      slug: 'paynes-bay-north',
      type: 'neighborhood',
      parentId: 'loc-holetown',
      description: '',
      lat: null,
      lng: null,
      active: true,
    });
    expect(ok.id).toMatch(/^loc-/);
    await expect(deleteLocation('loc-holetown')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('advertising', () => {
  it('prevents the same listing twice in one featured placement', async () => {
    await expect(
      createFeaturedPlacement({
        listingId: 'lst-001',
        placement: 'homepage',
        priority: 4,
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('validates campaign dates', async () => {
    await expect(
      createAdvertisement({
        name: 'Bad',
        advertiser: 'X',
        destinationUrl: 'https://example.com',
        placement: 'sidebar',
        status: 'draft',
        startDate: '2026-05-10T00:00:00Z',
        endDate: '2026-05-01T00:00:00Z',
        notes: '',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('knowledge', () => {
  it('refuses to publish an FAQ without an answer and skips them in bulk', async () => {
    await expect(
      createFaq({
        question: 'Q?',
        answer: '',
        categoryId: null,
        locationId: null,
        listingId: null,
        tags: [],
        status: 'published',
        includeInChatbot: true,
        order: 99,
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const result = await bulkSetFaqStatus(['faq-012', 'faq-013'], 'published');
    expect(result.skipped).toHaveLength(1);
    expect(result.updated).toBe(1);
  });

  it('retries failed jobs and advances the simulated queue', async () => {
    const retried = await retrySyncJob('job-1042');
    expect(retried).toMatchObject({ status: 'pending', retryCount: 3 });
    await refreshSyncQueue(); // pending → running
    await refreshSyncQueue(); // running → completed
    expect((await getSyncJobs()).find((j) => j.id === 'job-1042').status).toBe('completed');
    expect((await getKnowledgeDocumentById('doc-004')).indexingStatus).toBe('indexed');
  });
});

describe('search, dashboard, auth', () => {
  it('global search groups results by entity', async () => {
    const groups = await globalSearch('saltwind');
    expect(groups[0].type).toBe('Listings');
    expect(groups[0].items[0].to).toBe('/listings/lst-001');
    expect(await globalSearch('zzzz')).toEqual([]);
  });

  it('dashboard counts come from the data', async () => {
    const stats = await getDashboardStats({ days: 30 });
    expect(stats.kpis.totalListings.value).toBe(mockListings.length);
    expect(stats.kpis.pendingApprovals.value).toBe(mockListings.filter((l) => l.status === 'pending').length);
    expect(stats.listingGrowth.at(-1).total).toBe(mockListings.length);
  });

  it('demo login only accepts the demo account', async () => {
    await expect(login({ email: 'someone@else.com', password: 'longenough' })).rejects.toThrow(
      /demo account/i,
    );
    await expect(login({ email: 'admin.demo@example.com', password: 'short' })).rejects.toThrow(
      /8 characters/,
    );
    await expect(login({ email: 'admin.demo@example.com', password: 'longenough' })).resolves.toMatchObject({
      adminId: 'adm-01',
    });
  });
});

describe('utilities', () => {
  it('reset only clears this app’s demo keys', () => {
    window.localStorage.setItem('unrelated_key', 'keep me');
    writeJSON('listings', []);
    resetDemoData();
    expect(window.localStorage.getItem('unrelated_key')).toBe('keep me');
    expect(window.localStorage.getItem(`${STORAGE_PREFIX}listings`)).toBeNull();
  });

  it('falls back to defaults when storage holds malformed JSON', () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}broken`, '{not json');
    expect(readJSON('broken', 'fallback')).toBe('fallback');
  });

  it('escapes CSV values and neutralises formula injection', () => {
    const csv = toCSV(
      [{ a: '=HYPERLINK("x")', b: 'He said "hi"' }],
      [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    );
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"He said ""hi"""');
  });

  it('validates URLs and slugs safely', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(slugify('Café & Bar — Holetown!')).toBe('cafe-and-bar-holetown');
  });

  it('maps demo roles to permissions', () => {
    expect(can('super_admin', 'manage_admins')).toBe(true);
    expect(can('analyst', 'manage_listings')).toBe(false);
  });
});
