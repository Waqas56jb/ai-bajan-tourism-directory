import { db } from './db';
import { simulate, newId, notFound, conflict } from './mockApi';
import { logActivity } from './activityService';

const nowIso = () => new Date().toISOString();

function withCounts(category) {
  const listings = db.listings.all();
  return {
    ...category,
    listingCount: listings.filter(
      (l) => l.categoryId === category.id || l.secondaryCategoryIds?.includes(category.id),
    ).length,
  };
}

export const getCategories = () => simulate(() => db.categories.all().map(withCounts));

export const getCategoryById = (id) =>
  simulate(() => {
    const c = db.categories.find(id);
    if (!c) throw notFound('Category');
    return withCounts(c);
  });

function assertSlugFree(slug, excludeId) {
  if (db.categories.all().some((c) => c.slug === slug && c.id !== excludeId))
    throw conflict(`The slug “${slug}” is already in use.`);
}

export const createCategory = (data) =>
  simulate(
    () => {
      assertSlugFree(data.slug);
      const category = { ...data, id: newId('cat'), updatedAt: nowIso() };
      db.categories.insert(category);
      logActivity({
        action: 'listing_updated',
        entityType: 'category',
        entityId: category.id,
        entityName: category.name,
        summary: 'Category created.',
      });
      return withCounts(category);
    },
    { write: true },
  );

export const updateCategory = (id, data) =>
  simulate(
    () => {
      if (data.slug) assertSlugFree(data.slug, id);
      if (data.parentId === id) throw conflict('A category can’t be its own parent.');
      const updated = db.categories.patch(id, { ...data, updatedAt: nowIso() });
      logActivity({
        action: 'listing_updated',
        entityType: 'category',
        entityId: id,
        entityName: updated.name,
        summary: 'Category updated.',
      });
      return withCounts(updated);
    },
    { write: true },
  );

/**
 * Delete a category. Refuses when listings or subcategories reference it, unless
 * `reassignTo` is supplied — then listings are moved to that category first.
 */
export const deleteCategory = (id, { reassignTo } = {}) =>
  simulate(
    () => {
      const category = db.categories.find(id);
      if (!category) throw notFound('Category');
      if (db.categories.all().some((c) => c.parentId === id))
        throw conflict('Move or delete its subcategories first.');
      const referencing = db.listings
        .all()
        .filter((l) => l.categoryId === id || l.secondaryCategoryIds?.includes(id));
      if (referencing.length && !reassignTo) {
        throw conflict(`${referencing.length} listing(s) use this category. Reassign them before deleting.`);
      }
      referencing.forEach((l) =>
        db.listings.patch(l.id, {
          categoryId: l.categoryId === id ? reassignTo : l.categoryId,
          secondaryCategoryIds: (l.secondaryCategoryIds ?? []).filter((c) => c !== id),
          updatedAt: nowIso(),
        }),
      );
      db.categories.delete(id);
      logActivity({
        action: 'listing_updated',
        entityType: 'category',
        entityId: id,
        entityName: category.name,
        summary: referencing.length
          ? `Deleted; ${referencing.length} listing(s) reassigned.`
          : 'Category deleted.',
      });
      return { id };
    },
    { write: true },
  );
