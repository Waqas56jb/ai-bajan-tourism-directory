import { db } from './db';
import { simulate, newId, notFound, conflict } from './mockApi';
import { logActivity } from './activityService';
import { slugify } from '@/utils/validation';
import { LISTING_STATUSES } from '@/utils/constants';

const nowIso = () => new Date().toISOString();

/** Queue a (simulated) knowledge sync job when chatbot-visible content changes. */
function queueSync(listing, operation = 'update') {
  db.syncJobs.insert({
    id: newId('job'),
    sourceId: listing.id,
    sourceTitle: listing.name,
    sourceType: 'listing',
    operation,
    status: 'pending',
    createdAt: nowIso(),
    completedAt: null,
    retryCount: 0,
    errorSummary: '',
    log: ['Queued by listing change (simulated)'],
  });
}

function aiStateFor(listing) {
  const visible = listing.status === 'published' && listing.ai?.includeInChatbot;
  return {
    ...listing.ai,
    indexingStatus: visible ? 'pending' : listing.status === 'archived' ? 'excluded' : 'not_indexed',
  };
}

export const getListings = () => simulate(() => db.listings.all());

export const getListingById = (id) =>
  simulate(() => {
    const listing = db.listings.find(id);
    if (!listing) throw notFound('Listing');
    return listing;
  });

export function isSlugTaken(slug, excludeId) {
  return db.listings.all().some((l) => l.slug === slug && l.id !== excludeId);
}

/** A unique slug suggestion based on the business name. */
export function suggestSlug(name, excludeId) {
  const base = slugify(name) || 'listing';
  let slug = base;
  let n = 2;
  while (isSlugTaken(slug, excludeId)) slug = `${base}-${n++}`;
  return slug;
}

export const createListing = (data) =>
  simulate(
    () => {
      if (isSlugTaken(data.slug))
        throw conflict(`The slug “${data.slug}” is already used by another listing.`);
      const listing = {
        ...data,
        id: newId('lst'),
        views: 0,
        clicks: 0,
        ownerId: null,
        submittedBy: data.status === 'pending' ? 'adm-01' : null,
        submittedAt: data.status === 'pending' ? nowIso() : null,
        rejectionReason: '',
        reviewFeedback: '',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      listing.ai = aiStateFor(listing);
      db.listings.insert(listing);
      if (listing.ai.indexingStatus === 'pending') queueSync(listing, 'initial');
      logActivity({
        action: 'listing_created',
        entityType: 'listing',
        entityId: listing.id,
        entityName: listing.name,
        summary: `Created as ${LISTING_STATUSES[listing.status].label.toLowerCase()}.`,
      });
      return listing;
    },
    { write: true },
  );

export const updateListing = (id, data) =>
  simulate(
    () => {
      const existing = db.listings.find(id);
      if (!existing) throw notFound('Listing');
      if (data.slug && isSlugTaken(data.slug, id))
        throw conflict(`The slug “${data.slug}” is already used by another listing.`);
      const next = { ...existing, ...data, updatedAt: nowIso() };
      next.ai = aiStateFor(next);
      db.listings.patch(id, next);
      if (next.ai.indexingStatus === 'pending') queueSync(next);
      logActivity({
        action: 'listing_updated',
        entityType: 'listing',
        entityId: id,
        entityName: next.name,
        summary: 'Listing details updated.',
      });
      return next;
    },
    { write: true },
  );

const STATUS_ACTIONS = {
  published: 'listing_published',
  rejected: 'listing_rejected',
  archived: 'listing_updated',
  draft: 'listing_updated',
  pending: 'listing_updated',
};

/**
 * Change status. `approve` marks a pending listing as published.
 * @param {{ reason?: string, feedback?: string, approve?: boolean }} [meta]
 */
export const setListingStatus = (id, status, meta = {}) =>
  simulate(
    () => {
      const existing = db.listings.find(id);
      if (!existing) throw notFound('Listing');
      const next = {
        ...existing,
        status,
        rejectionReason: status === 'rejected' ? (meta.reason ?? '') : existing.rejectionReason,
        reviewFeedback: meta.feedback ?? (status === 'draft' ? existing.reviewFeedback : ''),
        updatedAt: nowIso(),
      };
      if (status === 'published' && !next.ai.includeInChatbot && meta.approve)
        next.ai = { ...next.ai, includeInChatbot: true };
      next.ai = aiStateFor(next);
      db.listings.patch(id, next);
      if (next.ai.indexingStatus === 'pending') queueSync(next);
      if (existing.status === 'published' && status !== 'published') queueSync(next, 'delete');
      const summary = meta.approve
        ? 'Approved submission and published.'
        : meta.reason
          ? `Rejected: ${meta.reason}`
          : meta.feedback
            ? `Changes requested: ${meta.feedback}`
            : `Status changed to ${LISTING_STATUSES[status].label}.`;
      logActivity({
        action: meta.approve ? 'listing_approved' : STATUS_ACTIONS[status],
        entityType: 'listing',
        entityId: id,
        entityName: existing.name,
        summary,
      });
      return next;
    },
    { write: true },
  );

export const bulkSetListingStatus = (ids, status) =>
  simulate(
    () => {
      const updated = [];
      for (const id of ids) {
        const existing = db.listings.find(id);
        if (!existing) continue;
        const next = { ...existing, status, updatedAt: nowIso() };
        next.ai = aiStateFor(next);
        db.listings.patch(id, next);
        updated.push(next);
      }
      logActivity({
        action: 'listing_updated',
        entityType: 'listing',
        entityId: ids.join(','),
        entityName: `${updated.length} listings`,
        summary: `Bulk status change to ${LISTING_STATUSES[status].label}.`,
      });
      return updated;
    },
    { write: true },
  );

export const toggleListingFeatured = (id) =>
  simulate(
    () => {
      const existing = db.listings.find(id);
      if (!existing) throw notFound('Listing');
      const next = db.listings.patch(id, { featured: !existing.featured, updatedAt: nowIso() });
      logActivity({
        action: 'listing_updated',
        entityType: 'listing',
        entityId: id,
        entityName: existing.name,
        summary: next.featured ? 'Marked as featured.' : 'Removed featured flag.',
      });
      return next;
    },
    { write: true },
  );

export const deleteListing = (id) =>
  simulate(
    () => {
      const removed = db.listings.delete(id);
      // Remove dependent demo placements so nothing points at a missing listing.
      db.featured
        .all()
        .filter((f) => f.listingId === id)
        .forEach((f) => db.featured.delete(f.id));
      logActivity({
        action: 'listing_updated',
        entityType: 'listing',
        entityId: id,
        entityName: removed.name,
        summary: 'Listing deleted.',
      });
      return { id };
    },
    { write: true },
  );

export const bulkDeleteListings = (ids) =>
  simulate(
    () => {
      ids.forEach((id) => {
        if (db.listings.find(id)) db.listings.delete(id);
        db.featured
          .all()
          .filter((f) => f.listingId === id)
          .forEach((f) => db.featured.delete(f.id));
      });
      logActivity({
        action: 'listing_updated',
        entityType: 'listing',
        entityId: ids.join(','),
        entityName: `${ids.length} listings`,
        summary: 'Bulk delete.',
      });
      return { ids };
    },
    { write: true },
  );
