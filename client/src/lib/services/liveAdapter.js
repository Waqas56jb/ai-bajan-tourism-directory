/**
 * Live adapter — talks to the AI Bajan Node.js API (VITE_DATA_MODE=live).
 * VITE_API_BASE_URL must point at the API's /api/v1 root, e.g.
 *   https://ai-bajan-tourism-directory-server.vercel.app/api/v1
 *
 * Server listings are mapped onto the shape the UI already renders. Directory search runs the
 * same client-side search used by the UI over the full published directory (fetched once and
 * cached briefly), so filters, facets and sorting behave identically to before.
 * Destinations and travel guides are editorial content bundled with the site.
 *
 * There is deliberately no fallback to mock data: if the API fails, the UI shows an error.
 */
import { apiClient, ApiError } from '@/lib/apiClient';
import { categories } from '@/data/categories';
import { destinations, destinationBySlug } from '@/data/destinations';
import { travelGuides, guideBySlug } from '@/data/travelGuides';
import { amenities as amenityVocabulary } from '@/data/amenities';
import { searchDirectory } from '@/lib/search';

const enc = encodeURIComponent;

// ------------------------------------------------------------------ mapping
/** Server category slug → site category slug. Unknown slugs fall back to "services". */
const CATEGORY_MAP = {
  hotels: 'hotels',
  restaurants: 'restaurants',
  cafes: 'restaurants',
  attractions: 'attractions',
  beaches: 'attractions',
  tours: 'tours',
  transport: 'transportation',
  shopping: 'shopping',
  'health-wellness': 'wellness',
  'events-nightlife': 'culture',
  pharmacies: 'services',
  'local-services': 'services',
};
const siteCategory = (slug) => CATEGORY_MAP[slug] ?? (categories.some((c) => c.slug === slug) ? slug : 'services');

const normalizeLabel = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const AMENITY_BY_LABEL = Object.fromEntries(
  Object.entries(amenityVocabulary).flatMap(([key, a]) => [
    [normalizeLabel(a.label), key],
    [normalizeLabel(key), key],
  ]),
);
AMENITY_BY_LABEL['swimming pool'] = 'pool';
AMENITY_BY_LABEL['wifi'] = 'free-wifi';
AMENITY_BY_LABEL['wi fi'] = 'free-wifi';

/** "St. James, Barbados" → "Saint James" (the site uses full parish names). */
const parishName = (name) => (name ? name.replace(/^St\.?\s+/i, 'Saint ') : null);

function splitArea(area) {
  // Server area label is "Neighbourhood, City, Region" (most specific first).
  const parts = String(area ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const region = parts.length ? parts[parts.length - 1] : null;
  const place = parts.length > 1 ? parts[parts.length - 2] : parts[0] ?? null;
  return { area: place, parish: parishName(region) };
}

const httpsOnly = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

/** Public API listing → the Business shape used by the UI. */
export function toBusiness(l) {
  const { area, parish } = splitArea(l.location?.area);
  const primary = l.category ? siteCategory(l.category.slug) : 'services';
  const amenityKeys = [];
  const extraHighlights = [];
  for (const a of l.details?.amenities ?? []) {
    const key = AMENITY_BY_LABEL[normalizeLabel(a)];
    if (key) amenityKeys.push(key);
    else extraHighlights.push(a);
  }
  const gallery = [l.media?.featuredImage, ...(l.media?.gallery ?? []).map((g) => g.url)].map(httpsOnly).filter(Boolean);
  return {
    id: l.id,
    slug: l.slug,
    name: l.name,
    category: primary,
    categories: [primary],
    businessType: l.listingType && l.listingType !== 'Business' ? l.listingType : (l.category?.name ?? ''),
    area: area ?? parish ?? 'Barbados',
    parish: parish ?? null,
    shortDescription: l.shortDescription ?? '',
    description: l.description || l.shortDescription || '',
    images: gallery,
    imageAlt: l.media?.featuredAlt || l.name,
    amenities: [...new Set(amenityKeys)],
    highlights: extraHighlights.slice(0, 6),
    keywords: [l.category?.name, l.listingType].filter(Boolean),
    website: httpsOnly(l.contact?.website),
    email: l.contact?.email || null,
    phone: l.contact?.phone || null,
    whatsapp: l.contact?.whatsapp || null,
    bookingUrl: httpsOnly(l.contact?.bookingUrl),
    address: l.location?.address || null,
    coordinates: typeof l.location?.lat === 'number' && typeof l.location?.lng === 'number' ? { lat: l.location.lat, lng: l.location.lng } : null,
    openingHours: (l.details?.openingHours ?? []).length ? l.details.openingHours.map((h) => ({ days: h.day, hours: h.hours })) : null,
    priceRange: l.details?.priceRange || null,
    accessibility: l.details?.accessibility || null,
    isFeatured: Boolean(l.featured),
    isSponsored: false,
    isVerified: false,
    status: 'published',
    demoContent: false,
  };
}

// ------------------------------------------------------------------ directory cache
const CACHE_MS = 60_000;
let cache = { at: 0, promise: null };

async function fetchAllListings(signal) {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const res = await apiClient.get('/public/listings', { query: { page, pageSize: 100, sort: 'featured' }, signal });
    all.push(...(res?.items ?? []).map(toBusiness));
    if (!res || page >= (res.totalPages ?? 1)) break;
  }
  return all;
}

function allBusinesses(signal) {
  if (!cache.promise || Date.now() - cache.at > CACHE_MS) {
    cache = { at: Date.now(), promise: fetchAllListings(signal).catch((e) => ((cache = { at: 0, promise: null }), Promise.reject(e))) };
  }
  return cache.promise;
}

// ------------------------------------------------------------------ chat session
const TOKEN_KEY = 'ai_bajan_chat_visitor_token';
const CONVERSATION_KEY = 'ai_bajan_chat_conversation_id';
const store = {
  get: (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      if (v) sessionStorage.setItem(k, v);
      else sessionStorage.removeItem(k);
    } catch {
      /* storage unavailable: the session simply isn't remembered */
    }
  },
};

const FOLLOW_UPS = {
  business_prospecting: ['Show their contact details.', 'Which ones are in Bridgetown?'],
  directory_search: ['Which ones are on the west coast?', 'Show their opening hours.'],
  product_availability: ['Show pharmacies in Bridgetown.'],
  no_evidence: ['What can I do in Barbados?', 'Find restaurants near Holetown.'],
};

async function sendChat(payload) {
  const send = (withConversation) =>
    apiClient.post(
      '/chat',
      {
        message: payload.message,
        language: 'en',
        ...(withConversation && store.get(CONVERSATION_KEY) ? { conversationId: store.get(CONVERSATION_KEY) } : {}),
      },
      { timeout: 45000, headers: store.get(TOKEN_KEY) ? { 'X-Visitor-Token': store.get(TOKEN_KEY) } : {} },
    );
  let res;
  try {
    res = await send(true);
  } catch (err) {
    // Expired session or a conversation that no longer exists: start a fresh conversation once.
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) {
      store.set(CONVERSATION_KEY, null);
      store.set(TOKEN_KEY, null);
      res = await send(false);
    } else throw err;
  }
  if (res?.visitorToken) store.set(TOKEN_KEY, res.visitorToken);
  if (res?.conversationId) store.set(CONVERSATION_KEY, res.conversationId);

  const listingIds = (res?.sources ?? []).filter((s) => s.type === 'listing').map((s) => s.id);
  let businesses = [];
  if (listingIds.length) {
    const all = await allBusinesses().catch(() => []);
    businesses = listingIds.map((id) => all.find((b) => b.id === id)).filter(Boolean).slice(0, 6);
  }
  const sources = (res?.sources ?? [])
    .filter((s) => s.type !== 'listing' || s.url)
    // The API cites listings as /listings/:slug; this site's detail route is /business/:slug.
    .map((s) => ({
      type: s.type === 'listing' ? 'listing' : 'page',
      title: s.title,
      url: s.url ? s.url.replace(/^\/listings\//, '/business/') : '/faq',
    }))
    .slice(0, 6);
  return {
    reply: res?.answer ?? '',
    businesses,
    sources,
    followUps: res?.needsClarification ? [] : FOLLOW_UPS[res?.status === 'no_evidence' ? 'no_evidence' : res?.meta?.intent] ?? [],
    meta: { mode: 'live', status: res?.status, intent: res?.meta?.intent },
  };
}

// ------------------------------------------------------------------ adapter
export const liveAdapter = {
  mode: 'live',
  /** Whether the public AI assistant is switched on (it stays off until a real AI model is connected). */
  async getAssistantStatus() {
    const s = await apiClient.get('/public/settings/chatbot');
    // Available unless the server explicitly reports the assistant as switched off.
    return { available: s?.aiAvailable !== false && s?.enabled !== false, welcomeMessage: s?.welcomeMessage ?? '', suggestedQuestions: s?.suggestedQuestions ?? [] };
  },
  getBusinesses: () => allBusinesses(),
  async getBusinessBySlug(slug) {
    return toBusiness(await apiClient.get(`/public/listings/${enc(slug)}`));
  },
  async searchBusinesses(filters, { signal } = {}) {
    return searchDirectory(await allBusinesses(signal), filters);
  },
  getCategories: async () => categories,
  getDestinations: async () => destinations,
  async getDestinationBySlug(slug) {
    const d = destinationBySlug[slug];
    if (!d) throw new ApiError('We couldn’t find that place.', { status: 404, code: 'NOT_FOUND', retryable: false });
    return d;
  },
  getTravelGuides: async () => travelGuides,
  async getGuideBySlug(slug) {
    const g = guideBySlug[slug];
    if (!g) throw new ApiError('We couldn’t find that guide.', { status: 404, code: 'NOT_FOUND', retryable: false });
    return g;
  },
  sendChatMessage: sendChat,
  /** Forget the server-side conversation (used when the visitor clears the chat). */
  resetChat() {
    store.set(CONVERSATION_KEY, null);
  },
  /** Contact messages are stored as general feedback for the admin team. */
  async submitContactForm({ name, email, subject, message, topic }) {
    const text = [topic && `[${topic}]`, subject, '', message, '', name && `— ${name}`].filter((x) => x !== undefined && x !== null && x !== false).join('\n');
    await apiClient.post('/feedback', { type: 'general', message: text.slice(0, 2000), contactEmail: email || '' });
    return { ok: true };
  },
  async submitNewsletter() {
    throw new ApiError('Newsletter sign-up isn’t available yet. Please check back soon.', { code: 'NOT_AVAILABLE', retryable: false });
  },
};
