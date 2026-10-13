/** Campaigns and featured placements (DEMO). Impressions and clicks are sample numbers. */
import { db } from './db';
import { simulate, newId, notFound, conflict } from './mockApi';
import { logActivity } from './activityService';

const nowIso = () => new Date().toISOString();

export const getAdvertisements = () => simulate(() => db.ads.all());

export const getAdvertisementById = (id) =>
  simulate(() => {
    const ad = db.ads.find(id);
    if (!ad) throw notFound('Campaign');
    return ad;
  });

function validateDates(data) {
  if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
    throw conflict('The end date must be on or after the start date.');
  }
}

export const createAdvertisement = (data) =>
  simulate(
    () => {
      validateDates(data);
      const ad = {
        ...data,
        id: newId('ad'),
        impressions: 0,
        clicks: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.ads.insert(ad);
      logActivity({
        action: data.status === 'active' ? 'ad_activated' : 'listing_updated',
        entityType: 'advertisement',
        entityId: ad.id,
        entityName: ad.name,
        summary: `Campaign created (${ad.status}).`,
      });
      return ad;
    },
    { write: true },
  );

export const updateAdvertisement = (id, data) =>
  simulate(
    () => {
      const existing = db.ads.find(id);
      if (!existing) throw notFound('Campaign');
      validateDates({ ...existing, ...data });
      const next = db.ads.patch(id, { ...data, updatedAt: nowIso() });
      logActivity({
        action: data.status === 'active' && existing.status !== 'active' ? 'ad_activated' : 'listing_updated',
        entityType: 'advertisement',
        entityId: id,
        entityName: next.name,
        summary:
          data.status && data.status !== existing.status
            ? `Status changed to ${data.status}.`
            : 'Campaign updated.',
      });
      return next;
    },
    { write: true },
  );

export const deleteAdvertisement = (id) =>
  simulate(
    () => {
      const ad = db.ads.delete(id);
      logActivity({
        action: 'listing_updated',
        entityType: 'advertisement',
        entityId: id,
        entityName: ad.name,
        summary: 'Campaign deleted.',
      });
      return { id };
    },
    { write: true },
  );

/* --------------------------- Featured listings -------------------------- */

export const getFeaturedPlacements = () => simulate(() => db.featured.all());

function assertUnique(data, excludeId) {
  const duplicate = db.featured
    .all()
    .some((f) => f.listingId === data.listingId && f.placement === data.placement && f.id !== excludeId);
  if (duplicate) throw conflict('This listing already has a featured placement in that slot.');
}

export const createFeaturedPlacement = (data) =>
  simulate(
    () => {
      if (!db.listings.find(data.listingId)) throw notFound('Listing');
      assertUnique(data);
      validateDates(data);
      const fp = {
        ...data,
        id: newId('fp'),
        impressions: 0,
        clicks: 0,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      db.featured.insert(fp);
      const listing = db.listings.find(data.listingId);
      if (data.status === 'active') db.listings.patch(listing.id, { featured: true });
      logActivity({
        action: 'featured_activated',
        entityType: 'featured',
        entityId: fp.id,
        entityName: listing.name,
        summary: `Featured placement added (${data.placement}).`,
      });
      return fp;
    },
    { write: true },
  );

export const updateFeaturedPlacement = (id, data) =>
  simulate(
    () => {
      const existing = db.featured.find(id);
      if (!existing) throw notFound('Placement');
      const next = { ...existing, ...data };
      assertUnique(next, id);
      validateDates(next);
      const saved = db.featured.patch(id, { ...data, updatedAt: nowIso() });
      const listing = db.listings.find(saved.listingId);
      if (listing) {
        const stillActive = db.featured
          .all()
          .some((f) => f.listingId === listing.id && f.status === 'active');
        db.listings.patch(listing.id, { featured: stillActive });
      }
      return saved;
    },
    { write: true },
  );

export const deleteFeaturedPlacement = (id) =>
  simulate(
    () => {
      const fp = db.featured.delete(id);
      const listing = db.listings.find(fp.listingId);
      if (listing) {
        const stillActive = db.featured
          .all()
          .some((f) => f.listingId === listing.id && f.status === 'active');
        db.listings.patch(listing.id, { featured: stillActive });
      }
      return { id };
    },
    { write: true },
  );
