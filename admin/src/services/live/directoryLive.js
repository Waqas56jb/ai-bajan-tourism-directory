/** Live listings, categories and locations (AI Bajan API). Shapes match the dashboard's model. */
import { slugify } from '@/utils/validation';
import { api, getAll, isUuid, compact } from './http';

/* ------------------------------------------------------------------ mapping */
const INDEX_STATUS = { keyword_only: 'indexed', removed: 'excluded' };
export const mapIndexStatus = (s) => INDEX_STATUS[s] ?? s ?? 'not_indexed';
const idOrNull = (v) => (isUuid(v) ? v : null);
const str = (v) => (typeof v === 'string' ? v : '');

export function fromServerListing(l) {
  const { publicNotes, notes, ...details } = l.details ?? {};
  return {
    ...l,
    location: { ...l.location, displayPreference: l.location?.displayPreference === 'full' ? 'exact' : l.location?.displayPreference },
    details: { ...details, notes: publicNotes ?? '' },
    internalNotes: notes ?? '',
    ai: {
      includeInChatbot: l.ai?.includeInChatbot ?? true,
      includeContact: l.ai?.includeContact ?? true,
      includeDescription: true,
      excludePrivateNotes: true,
      indexingStatus: mapIndexStatus(l.ai?.indexingStatus),
      lastIndexedAt: l.ai?.lastIndexedAt ?? null,
      chunkCount: l.ai?.chunkCount ?? 0,
    },
    rejectionReason: l.review?.rejectionReason ?? '',
    reviewFeedback: l.review?.feedback ?? '',
    ownerId: l.ownerUserId ?? null,
    submittedBy: null,
    submittedAt: l.status === 'pending' ? l.updatedAt : null,
    views: 0,
    clicks: 0,
  };
}

/** Dashboard form values → the API's strict listing payload (only known fields are sent). */
export function toServerListing(v) {
  const loc = v.location ?? {};
  const c = v.contact ?? {};
  const d = v.details ?? {};
  const m = v.media ?? {};
  const s = v.seo ?? {};
  return compact({
    name: v.name,
    slug: v.slug || undefined,
    shortDescription: v.shortDescription,
    description: v.description,
    listingType: v.listingType,
    categoryId: idOrNull(v.categoryId),
    secondaryCategoryIds: (v.secondaryCategoryIds ?? []).filter(isUuid),
    location: {
      countryId: idOrNull(loc.countryId),
      regionId: idOrNull(loc.regionId),
      cityId: idOrNull(loc.cityId),
      neighborhoodId: idOrNull(loc.neighborhoodId),
      address: str(loc.address),
      postalCode: str(loc.postalCode),
      lat: typeof loc.lat === 'number' && Number.isFinite(loc.lat) ? loc.lat : null,
      lng: typeof loc.lng === 'number' && Number.isFinite(loc.lng) ? loc.lng : null,
      displayPreference: loc.displayPreference === 'exact' ? 'full' : loc.displayPreference || 'area',
    },
    contact: {
      phone: str(c.phone),
      email: str(c.email),
      website: str(c.website),
      whatsapp: str(c.whatsapp),
      bookingUrl: str(c.bookingUrl),
      socials: (c.socials ?? []).filter((x) => x?.url).map((x) => ({ platform: str(x.platform) || 'Link', url: x.url })),
    },
    details: {
      openingHours: (d.openingHours ?? []).filter((h) => h?.day && h?.hours).map((h) => ({ day: h.day, hours: h.hours })),
      priceRange: str(d.priceRange),
      amenities: d.amenities ?? [],
      accessibility: str(d.accessibility),
      languages: d.languages ?? [],
      audiences: d.audiences ?? [],
      bookingRequirements: str(d.bookingRequirements),
      notes: str(v.internalNotes),
      publicNotes: str(d.notes),
    },
    media: {
      featuredImage: str(m.featuredImage),
      featuredAlt: str(m.featuredAlt),
      gallery: (m.gallery ?? []).filter((g) => g?.url).map((g) => ({ url: g.url, alt: str(g.alt) })),
    },
    seo: {
      title: str(s.title),
      description: str(s.description),
      keywords: s.keywords ?? [],
      canonicalUrl: str(s.canonicalUrl),
      searchVisible: s.searchVisible ?? true,
      indexing: s.indexing === 'noindex' ? 'noindex' : 'index',
    },
    ai: { includeInChatbot: v.ai?.includeInChatbot ?? true, includeContact: v.ai?.includeContact ?? true },
  });
}

/* ------------------------------------------------------------------ listings */
let listingCache = [];

export async function getListings() {
  listingCache = (await getAll('/admin/listings')).map(fromServerListing);
  return listingCache;
}

export async function getListingById(id) {
  return fromServerListing(await api(`/admin/listings/${id}`));
}

export function isSlugTaken(slug, excludeId) {
  return listingCache.some((l) => l.slug === slug && l.id !== excludeId);
}

export function suggestSlug(name, excludeId) {
  const base = slugify(name) || 'listing';
  let slug = base;
  let n = 2;
  while (isSlugTaken(slug, excludeId)) slug = `${base}-${n++}`;
  return slug;
}

async function postStatus(id, status, meta = {}) {
  return fromServerListing(
    await api(`/admin/listings/${id}/status`, {
      method: 'POST',
      body: compact({ status, reason: meta.reason || undefined, feedback: meta.feedback || undefined }),
    }),
  );
}

export async function createListing(data) {
  const wanted = data.status ?? 'draft';
  let listing = fromServerListing(
    await api('/admin/listings', { method: 'POST', body: { ...toServerListing(data), status: wanted === 'pending' ? 'pending' : 'draft' } }),
  );
  if (!['draft', 'pending'].includes(wanted)) listing = await postStatus(listing.id, wanted);
  if (data.featured) listing = fromServerListing(await api(`/admin/listings/${listing.id}/featured`, { method: 'POST', body: { featured: true } }));
  return listing;
}

export async function updateListing(id, data) {
  let listing = fromServerListing(await api(`/admin/listings/${id}`, { method: 'PATCH', body: toServerListing(data) }));
  if (data.status && data.status !== listing.status) listing = await postStatus(id, data.status);
  if (typeof data.featured === 'boolean' && data.featured !== listing.featured) {
    listing = fromServerListing(await api(`/admin/listings/${id}/featured`, { method: 'POST', body: { featured: data.featured } }));
  }
  return listing;
}

export async function setListingStatus(id, status, meta = {}) {
  if (status === 'published' && meta.approve) {
    const current = await getListingById(id);
    if (!current.ai.includeInChatbot) await api(`/admin/listings/${id}`, { method: 'PATCH', body: { ai: { includeInChatbot: true } } });
  }
  return postStatus(id, status, meta);
}

const BULK_ACTION = { published: 'publish', archived: 'archive', draft: 'draft' };

export async function bulkSetListingStatus(ids, status) {
  if (BULK_ACTION[status]) {
    await api('/admin/listings/bulk', { method: 'POST', body: { action: BULK_ACTION[status], ids } });
    return ids.map((id) => ({ id, status }));
  }
  const out = [];
  for (const id of ids) out.push(await postStatus(id, status));
  return out;
}

export async function toggleListingFeatured(id) {
  const current = await getListingById(id);
  return fromServerListing(await api(`/admin/listings/${id}/featured`, { method: 'POST', body: { featured: !current.featured } }));
}

export async function deleteListing(id) {
  await api(`/admin/listings/${id}`, { method: 'DELETE' });
  return { id };
}

export async function bulkDeleteListings(ids) {
  await api('/admin/listings/bulk', { method: 'POST', body: { action: 'delete', ids } });
  return { ids };
}

/* ------------------------------------------------------------------ categories */
const fromServerCategory = (c) => ({ ...c, image: c.image ?? '', parentId: c.parentId ?? null });
const toServerCategory = (v) =>
  compact({
    name: v.name,
    slug: v.slug || undefined,
    description: v.description ?? undefined,
    icon: typeof v.icon === 'string' ? v.icon.replace(/[^A-Za-z0-9]/g, '') : undefined,
    image: typeof v.image === 'string' && /^https?:\/\//i.test(v.image) ? v.image : v.image === '' ? '' : undefined,
    parentId: v.parentId === undefined ? undefined : idOrNull(v.parentId),
    synonyms: Array.isArray(v.synonyms) ? v.synonyms : undefined,
    order: Number.isFinite(Number(v.order)) && v.order !== '' && v.order !== undefined ? Number(v.order) : undefined,
    active: typeof v.active === 'boolean' ? v.active : undefined,
  });

export async function getCategories() {
  return ((await api('/admin/categories'))?.items ?? []).map(fromServerCategory);
}
export async function getCategoryById(id) {
  return fromServerCategory(await api(`/admin/categories/${id}`));
}
export async function createCategory(data) {
  return fromServerCategory(await api('/admin/categories', { method: 'POST', body: toServerCategory(data) }));
}
export async function updateCategory(id, data) {
  return fromServerCategory(await api(`/admin/categories/${id}`, { method: 'PATCH', body: toServerCategory(data) }));
}
export async function deleteCategory(id, { reassignTo } = {}) {
  await api(`/admin/categories/${id}`, { method: 'DELETE', query: { reassignTo } });
  return { id };
}

/* ------------------------------------------------------------------ locations */
const fromServerLocation = (l) => ({ ...l, parentId: l.parentId ?? null });
const toServerLocation = (v) =>
  compact({
    name: v.name,
    slug: v.slug || undefined,
    type: v.type,
    parentId: v.type === 'country' ? null : idOrNull(v.parentId),
    description: v.description ?? undefined,
    lat: v.lat === '' || v.lat === undefined || v.lat === null ? null : Number(v.lat),
    lng: v.lng === '' || v.lng === undefined || v.lng === null ? null : Number(v.lng),
    aliases: Array.isArray(v.aliases) ? v.aliases : undefined,
    active: typeof v.active === 'boolean' ? v.active : undefined,
  });

export async function getLocations() {
  return ((await api('/admin/locations'))?.items ?? []).map(fromServerLocation);
}
export async function getLocationById(id) {
  return fromServerLocation(await api(`/admin/locations/${id}`));
}
export async function createLocation(data) {
  return fromServerLocation(await api('/admin/locations', { method: 'POST', body: toServerLocation(data) }));
}
export async function updateLocation(id, data) {
  return fromServerLocation(await api(`/admin/locations/${id}`, { method: 'PATCH', body: toServerLocation(data) }));
}
export async function deleteLocation(id) {
  await api(`/admin/locations/${id}`, { method: 'DELETE' });
  return { id };
}
