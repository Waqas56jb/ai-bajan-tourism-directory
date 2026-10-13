import { db } from './db';
import { simulate, newId, notFound, conflict } from './mockApi';
import { logActivity } from './activityService';
import { LOCATION_TYPES } from '@/data/mockLocations';

const nowIso = () => new Date().toISOString();

const LEVEL_FIELD = {
  country: 'countryId',
  region: 'regionId',
  city: 'cityId',
  neighborhood: 'neighborhoodId',
};

function withCounts(loc) {
  const field = LEVEL_FIELD[loc.type];
  return {
    ...loc,
    listingCount: db.listings.all().filter((l) => l.location?.[field] === loc.id).length,
    childCount: db.locations.all().filter((c) => c.parentId === loc.id).length,
  };
}

export const getLocations = () => simulate(() => db.locations.all().map(withCounts));

export const getLocationById = (id) =>
  simulate(() => {
    const loc = db.locations.find(id);
    if (!loc) throw notFound('Location');
    return withCounts(loc);
  });

function validateHierarchy(data, id) {
  const expectedParent = LOCATION_TYPES[data.type]?.parentType;
  if (!expectedParent) {
    if (data.parentId) throw conflict('A country can’t have a parent location.');
    return;
  }
  const parent = db.locations.find(data.parentId);
  if (!parent) throw conflict(`Choose a parent ${LOCATION_TYPES[expectedParent].label.toLowerCase()}.`);
  if (parent.type !== expectedParent)
    throw conflict(`The parent must be a ${LOCATION_TYPES[expectedParent].label.toLowerCase()}.`);
  if (parent.id === id) throw conflict('A location can’t be its own parent.');
}

function assertSlugFree(slug, excludeId) {
  if (db.locations.all().some((l) => l.slug === slug && l.id !== excludeId))
    throw conflict(`The slug “${slug}” is already in use.`);
}

export const createLocation = (data) =>
  simulate(
    () => {
      validateHierarchy(data);
      assertSlugFree(data.slug);
      const loc = { ...data, id: newId('loc'), updatedAt: nowIso() };
      db.locations.insert(loc);
      logActivity({
        action: 'listing_updated',
        entityType: 'location',
        entityId: loc.id,
        entityName: loc.name,
        summary: 'Location created.',
      });
      return withCounts(loc);
    },
    { write: true },
  );

export const updateLocation = (id, data) =>
  simulate(
    () => {
      validateHierarchy(data, id);
      assertSlugFree(data.slug, id);
      const updated = db.locations.patch(id, { ...data, updatedAt: nowIso() });
      logActivity({
        action: 'listing_updated',
        entityType: 'location',
        entityId: id,
        entityName: updated.name,
        summary: 'Location updated.',
      });
      return withCounts(updated);
    },
    { write: true },
  );

export const deleteLocation = (id) =>
  simulate(
    () => {
      const found = db.locations.find(id);
      if (!found) throw notFound('Location');
      const loc = withCounts(found);
      if (loc.childCount)
        throw conflict(`This location has ${loc.childCount} child location(s). Move or delete them first.`);
      if (loc.listingCount)
        throw conflict(`${loc.listingCount} listing(s) use this location. Update those listings first.`);
      db.locations.delete(id);
      logActivity({
        action: 'listing_updated',
        entityType: 'location',
        entityId: id,
        entityName: loc.name,
        summary: 'Location deleted.',
      });
      return { id };
    },
    { write: true },
  );
