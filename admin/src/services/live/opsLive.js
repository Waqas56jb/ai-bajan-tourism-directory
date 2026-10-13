/** Live conversations, feedback, monitoring, activity, users, settings, dashboard and search. */
import { api, getAll, compact, toDate, isUuid } from './http';
import { fromServerRole, toServerRole } from './authLive';
import { fromServerListing } from './directoryLive';
import { fromServerDocument } from './knowledgeLive';

const truncate = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? '');

/* ------------------------------------------------------------------ conversations */
export async function getConversations() {
  const rows = await getAll('/admin/conversations');
  return rows.map((c) => ({
    id: c.id,
    startedAt: c.startedAt,
    endedAt: c.lastActivityAt,
    messageCount: c.messageCount,
    topic: truncate(c.firstQuestion || 'Conversation', 60),
    relatedCategoryId: null,
    relatedListingId: null,
    status: c.outcome,
    feedback: c.negativeFeedback > 0 ? 'negative' : null,
    reviewStatus: c.reviewStatus,
    notes: [],
    retrieval: { documentsSearched: 0, sourcesUsed: 0, latencyMs: 0 },
    messages: [],
  }));
}

export async function getConversationById(id) {
  const c = await api(`/admin/conversations/${id}`);
  const diag = new Map((c.diagnostics ?? []).map((d) => [d.messageId, d]));
  const messages = (c.messages ?? []).map((m) => {
    const d = diag.get(m.id);
    return {
      id: m.id,
      role: m.role,
      text: m.content,
      at: m.createdAt,
      sources: (m.sources ?? []).map((s) => ({ type: s.type, id: s.id, title: s.title, snippet: '', meta: s.url ?? '' })),
      ...(d ? { diagnostics: { intent: d.intent, evidence: d.evidence, fallbackReason: d.fallbackReason, methods: d.methods, candidates: d.candidateCount } } : {}),
    };
  });
  const totals = (c.diagnostics ?? []).reduce(
    (acc, d) => ({ searched: acc.searched + (d.candidateCount ?? 0), latency: acc.latency + (d.latencyMs?.total ?? 0) }),
    { searched: 0, latency: 0 },
  );
  return {
    id: c.id,
    startedAt: c.startedAt,
    endedAt: c.lastActivityAt,
    messageCount: c.messageCount,
    topic: truncate(messages.find((m) => m.role === 'user')?.text || 'Conversation', 60),
    status: c.outcome,
    feedback: null,
    reviewStatus: c.reviewStatus,
    notes: (c.notes ?? []).map((n) => ({ id: n.id, author: n.author ?? 'Administrator', text: n.note, at: n.createdAt })),
    retrieval: {
      documentsSearched: totals.searched,
      sourcesUsed: messages.reduce((n, m) => n + m.sources.length, 0),
      latencyMs: c.diagnostics?.length ? Math.round(totals.latency / c.diagnostics.length) : 0,
    },
    summary: c.summary,
    messages,
  };
}

export async function setConversationReview(id, reviewStatus) {
  await api(`/admin/conversations/${id}/review`, { method: 'POST', body: { reviewStatus } });
  return getConversationById(id);
}

export async function addConversationNote(id, text) {
  await api(`/admin/conversations/${id}/notes`, { method: 'POST', body: { note: text.trim() } });
  return getConversationById(id);
}

export async function getChatbotStats(days = 30) {
  const d = await api('/admin/analytics/dashboard', { query: { days } });
  const series = (d.daily ?? []).map((x) => ({ date: x.date, conversations: x.conversations, answered: Math.max(0, x.conversations - x.unanswered), fallback: x.unanswered }));
  const fallback = series.reduce((n, x) => n + x.fallback, 0);
  const conversations = d.chatbot?.conversations ?? 0;
  return {
    current: {
      conversations,
      questions: Math.round((d.chatbot?.messages ?? 0) / 2),
      answered: Math.max(0, conversations - fallback),
      fallback,
      positive: 0,
      negative: 0,
      latencyMs: 0,
    },
    previous: null,
    satisfaction: null,
    series,
    topics: (d.topSources ?? []).map((s) => ({ topic: `${s.type} source`, count: s.uses })),
    feedback: [],
  };
}

/* ------------------------------------------------------------------ settings documents */
async function getDoc(key, defaults) {
  try {
    const row = await api(`/admin/settings/${key}`);
    return { ...defaults, ...(row?.value ?? {}) };
  } catch (err) {
    if (err.status === 404) return { ...defaults };
    throw err;
  }
}
/** Only flat values are stored server-side (no nested objects, no secrets). */
const flat = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v === null || ['string', 'number', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.every((x) => typeof x === 'string'))));
const putDoc = async (key, value, defaults) => ({ ...defaults, ...((await api(`/admin/settings/${key}`, { method: 'PUT', body: flat(value) }))?.value ?? {}) });

export const makeChatbotSettings = (DEFAULTS) => ({
  getChatbotSettings: () => getDoc('chatbot', DEFAULTS),
  saveChatbotSettings: (settings) => putDoc('chatbot', settings, DEFAULTS),
  resetChatbotSettings: () => putDoc('chatbot', DEFAULTS, DEFAULTS),
});

export const makeGeneralSettings = (DEFAULTS) => ({
  getGeneralSettings: () => getDoc('general', DEFAULTS),
  saveGeneralSettings: (value) => putDoc('general', value, DEFAULTS),
  resetGeneralSettings: () => putDoc('general', DEFAULTS, DEFAULTS),
});

/* ------------------------------------------------------------------ feedback */
const fromServerFeedback = (f) => ({
  id: f.id,
  type: f.type,
  summary: truncate(f.message || (f.helpful === false ? 'Answer marked not helpful' : f.helpful ? 'Answer marked helpful' : f.type), 90),
  text: f.message,
  status: f.status,
  priority: f.priority,
  relatedType: f.listingId ? 'listing' : f.conversationId ? 'conversation' : null,
  relatedId: f.listingId ?? f.conversationId ?? null,
  submittedBy: f.contactEmail || 'Anonymous visitor',
  submittedAt: f.createdAt,
  notes: (f.notes ?? []).map((n, i) => ({ id: `${f.id}-n${i}`, author: n.by, text: n.text, at: n.at })),
  resolution: '',
  updatedAt: f.updatedAt,
});

export async function getFeedback() {
  return (await getAll('/admin/feedback')).map(fromServerFeedback);
}
export async function updateFeedback(id, changes) {
  await api(`/admin/feedback/${id}`, {
    method: 'PATCH',
    body: compact({ status: changes.status, priority: changes.priority, note: changes.resolution?.trim() ? `Resolution: ${changes.resolution.trim()}` : undefined }),
  });
  return { id, ...changes };
}
export async function addFeedbackNote(id, text) {
  await api(`/admin/feedback/${id}`, { method: 'PATCH', body: { note: text.trim() } });
  return { id };
}

/* ------------------------------------------------------------------ monitoring */
export async function getSystemHealth() {
  const h = await api('/admin/monitoring/health');
  const at = h.checkedAt;
  const status = (s) => (s === 'up' || s === 'configured' ? 'operational' : s === 'stale' || s === 'never_seen' || s === 'not_configured' ? 'degraded' : 'outage');
  const svc = (id, description, s, link, note) => ({
    id,
    description,
    demoStatus: status(s),
    connection: 'connected',
    lastCheckedAt: at,
    link,
    incidents: note ? [{ id: `${id}-note`, at, text: note }] : [],
  });
  return {
    connected: true,
    services: [
      svc('api', 'AI Bajan Node.js API.', 'up', '/monitoring/errors'),
      svc('supabase', `Database round-trip ${h.services.database.latencyMs} ms.`, h.services.database.status, '/monitoring/errors'),
      svc('openai', `Chat ${h.services.llm.chatModel}, embeddings ${h.services.llm.embeddingModel}.`, h.services.llm.status, '/chatbot/settings', h.services.llm.status === 'not_configured' ? 'OPENAI_API_KEY is not configured: the public assistant stays disabled.' : ''),
      svc('sync', `Queue: ${h.queue?.pending ?? 0} pending, ${h.queue?.failed ?? 0} failed.`, h.services.worker.status, '/knowledge/sync', h.services.worker.status !== 'up' ? 'Indexing runs on demand (Knowledge sync → Process queue) and by the daily cron.' : ''),
    ],
    history: [],
  };
}

export async function getErrorLogs() {
  return (await getAll('/admin/monitoring/errors')).map((e) => ({
    id: e.id,
    at: e.createdAt,
    severity: e.severity,
    service: e.category === 'sync' ? 'sync' : 'api',
    category: e.code,
    message: e.message,
    reference: e.requestId || e.route,
    status: e.resolved ? 'reviewed' : 'open',
    details: e.route ? `Route / source: ${e.route}` : '',
  }));
}
export async function updateErrorLog(id, changes) {
  await api(`/admin/monitoring/errors/${id}`, { method: 'PATCH', body: { resolved: changes.status === 'reviewed' || changes.status === 'resolved' } });
  return { id, ...changes };
}

/* Notifications are derived from live data; "read" state is kept in this browser. */
const READ_KEY = 'ai_bajan_admin_read_notifications';
const readSet = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
  } catch {
    return new Set();
  }
};
const saveRead = (s) => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...s].slice(-500)));
  } catch {
    /* ignore */
  }
};
export async function getNotifications() {
  const [pending, failed, feedback] = await Promise.all([
    api('/admin/listings', { query: { status: 'pending', pageSize: 10 } }).catch(() => ({ items: [] })),
    api('/admin/sync/jobs', { query: { status: 'failed', pageSize: 10 } }).catch(() => ({ items: [] })),
    api('/admin/feedback', { query: { status: 'new', pageSize: 10 } }).catch(() => ({ items: [] })),
  ]);
  const read = readSet();
  const items = [
    ...pending.items.map((l) => ({ id: `lst-${l.id}`, title: 'Listing awaiting review', body: l.name, at: l.updatedAt, to: '/listings/submissions', tone: 'warning' })),
    ...failed.items.map((j) => ({ id: `job-${j.id}`, title: 'Indexing job failed', body: `${j.sourceTitle ?? j.sourceType}: ${truncate(j.lastError, 80)}`, at: j.completedAt ?? j.createdAt, to: '/knowledge/sync', tone: 'danger' })),
    ...feedback.items.map((f) => ({ id: `fb-${f.id}`, title: 'New feedback', body: truncate(f.message || f.type, 80), at: f.createdAt, to: '/feedback', tone: 'info' })),
  ];
  return items.map((n) => ({ ...n, read: read.has(n.id) })).sort((a, b) => new Date(b.at) - new Date(a.at));
}
export async function markNotificationRead(id) {
  const s = readSet();
  s.add(id);
  saveRead(s);
  return { id, read: true };
}
export async function markAllNotificationsRead() {
  const s = readSet();
  for (const n of await getNotifications()) s.add(n.id);
  saveRead(s);
  return true;
}

/* ------------------------------------------------------------------ activity */
const ACTION_MAP = {
  'listing.created': 'listing_created',
  'listing.updated': 'listing_updated',
  'listing.published': 'listing_published',
  'listing.pending': 'listing_submitted',
  'listing.rejected': 'listing_rejected',
};
const mapAction = (a) =>
  ACTION_MAP[a] ??
  (a.startsWith('listing.') ? 'listing_updated' : a.startsWith('faq.') ? 'faq_updated' : a.startsWith('document.') ? 'document_updated' : a.startsWith('settings.') ? 'chatbot_settings' : a.startsWith('admin.') || a.startsWith('user.') ? 'role_changed' : a.startsWith('featured.') ? 'featured_activated' : a.startsWith('ad.') ? 'ad_activated' : a.replace(/\./g, '_'));

export async function getActivityLogs() {
  const res = await api('/admin/activity', { query: { pageSize: 100 } });
  return (res?.items ?? []).map((e) => ({
    id: e.id,
    at: e.createdAt,
    actor: e.actor || 'System',
    action: mapAction(e.action),
    entityType: e.entityType,
    entityId: e.entityId,
    entityName: e.entityName || e.entityType,
    summary: e.summary || e.action,
    status: e.status,
  }));
}
export function logActivity() {
  /* The API writes the audit log server-side. */
}

/* ------------------------------------------------------------------ users & administrators */
const fromServerUser = (u) => ({ id: u.id, name: u.displayName || u.email, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt, updatedAt: u.createdAt, lastActiveAt: u.lastActiveAt, phone: null, organisation: null, listingCount: u.listingCount ?? 0 });
export async function getUsers() {
  return (await getAll('/admin/users')).map(fromServerUser);
}
export async function getUserById(id) {
  return { ...fromServerUser(await api(`/admin/users/${id}`)), listings: [], activity: [] };
}
export async function updateUser(id, changes) {
  await api(`/admin/users/${id}`, { method: 'PATCH', body: compact({ status: changes.status, role: changes.role }) });
  return getUserById(id);
}
const fromServerAdmin = (a) => ({ id: a.id, name: a.displayName || a.email, email: a.email, role: fromServerRole(a.role), status: a.status === 'suspended' ? 'deactivated' : a.status, title: '', lastLoginAt: a.lastSignInAt, createdAt: a.createdAt });
export async function getAdministrators() {
  return ((await api('/admin/administrators'))?.items ?? []).map(fromServerAdmin);
}
export async function getAdministratorById(id) {
  const all = await getAdministrators();
  const a = all.find((x) => x.id === id);
  if (!a) throw Object.assign(new Error('Administrator not found.'), { status: 404 });
  return a;
}
export async function inviteAdministrator({ name, email, role }) {
  return fromServerAdmin(await api('/admin/administrators', { method: 'POST', body: { email, displayName: name ?? '', role: toServerRole(role) } }));
}
export async function updateAdministrator(id, changes) {
  return fromServerAdmin(
    await api(`/admin/administrators/${id}`, {
      method: 'PATCH',
      body: compact({ role: changes.role ? toServerRole(changes.role) : undefined, status: changes.status === 'deactivated' ? 'suspended' : changes.status, displayName: changes.name }),
    }),
  );
}

/* ------------------------------------------------------------------ ads & featured */
const fromServerAd = (a) => ({ id: a.id, name: a.title, advertiser: a.advertiserName, destinationUrl: a.targetUrl, imageUrl: a.imageUrl || null, imageAlt: a.imageAlt, placement: a.placement, status: a.status, startDate: a.startDate, endDate: a.endDate, impressions: a.impressions, clicks: a.clicks, notes: a.internalNotes, listingId: a.listingId, createdAt: a.createdAt, updatedAt: a.updatedAt });
const toServerAd = (v) =>
  compact({
    title: v.name,
    advertiserName: v.advertiser,
    placement: v.placement,
    status: v.status,
    startDate: toDate(v.startDate),
    endDate: toDate(v.endDate),
    imageUrl: v.imageUrl === undefined ? undefined : v.imageUrl || '',
    imageAlt: v.imageAlt,
    targetUrl: v.destinationUrl === undefined ? undefined : v.destinationUrl || '',
    listingId: v.listingId === undefined ? undefined : isUuid(v.listingId) ? v.listingId : null,
    internalNotes: v.notes,
  });
export async function getAdvertisements() {
  return (await getAll('/admin/ads')).map(fromServerAd);
}
export async function getAdvertisementById(id) {
  return fromServerAd(await api(`/admin/ads/${id}`));
}
export async function createAdvertisement(data) {
  return fromServerAd(await api('/admin/ads', { method: 'POST', body: toServerAd(data) }));
}
export async function updateAdvertisement(id, data) {
  return fromServerAd(await api(`/admin/ads/${id}`, { method: 'PATCH', body: toServerAd(data) }));
}
export async function deleteAdvertisement(id) {
  await api(`/admin/ads/${id}`, { method: 'DELETE' });
  return { id };
}
const fromServerFeatured = (f) => ({ id: f.id, listingId: f.listingId, placement: f.placement, priority: f.position, status: f.status, startDate: f.startDate, endDate: f.endDate, impressions: 0, clicks: 0, notes: f.notes, createdAt: f.createdAt, updatedAt: f.updatedAt });
const toServerFeatured = (v, create) =>
  compact({
    ...(create ? { listingId: v.listingId, placement: v.placement } : {}),
    position: v.priority === undefined || v.priority === '' ? undefined : Number(v.priority),
    status: v.status,
    startDate: toDate(v.startDate),
    endDate: toDate(v.endDate),
    notes: v.notes,
  });
export async function getFeaturedPlacements() {
  return ((await api('/admin/featured'))?.items ?? []).map(fromServerFeatured);
}
export async function createFeaturedPlacement(data) {
  return fromServerFeatured(await api('/admin/featured', { method: 'POST', body: toServerFeatured(data, true) }));
}
export async function updateFeaturedPlacement(id, data) {
  return fromServerFeatured(await api(`/admin/featured/${id}`, { method: 'PATCH', body: toServerFeatured(data, false) }));
}
export async function deleteFeaturedPlacement(id) {
  await api(`/admin/featured/${id}`, { method: 'DELETE' });
  return { id };
}

/* ------------------------------------------------------------------ dashboard */
export async function getDashboardStats({ days = 30 } = {}) {
  const [listingsRaw, docsRaw, featured, categories, activity, analytics] = await Promise.all([
    getAll('/admin/listings'),
    getAll('/admin/knowledge/documents'),
    getFeaturedPlacements(),
    api('/admin/categories').then((r) => r.items),
    getActivityLogs(),
    api('/admin/analytics/dashboard', { query: { days } }),
  ]);
  const listings = listingsRaw.map(fromServerListing);
  const documents = docsRaw.map(fromServerDocument);
  const DAY = 86_400_000;
  const now = Date.now();
  const between = (from, to) => listings.filter((l) => {
    const t = new Date(l.createdAt).getTime();
    return t > now - from * DAY && t <= now - to * DAY;
  }).length;
  const byStatus = (s) => listings.filter((l) => l.status === s).length;
  const step = days <= 31 ? 1 : 7;
  const growth = [];
  for (let back = days - 1; back >= 0; back -= step) {
    const end = now - Math.max(0, back - step + 1) * DAY;
    const start = end - step * DAY;
    growth.push({
      date: new Date(now - back * DAY).toISOString(),
      total: listings.filter((l) => new Date(l.createdAt).getTime() <= end).length,
      created: listings.filter((l) => {
        const t = new Date(l.createdAt).getTime();
        return t > start && t <= end;
      }).length,
    });
  }
  const daily = analytics.daily ?? [];
  const conversations = analytics.chatbot?.conversations ?? 0;
  const fallback = daily.reduce((n, d) => n + d.unanswered, 0);
  return {
    range: { days },
    kpis: {
      totalListings: { value: listings.length, created: between(days, 0), createdPrev: between(days * 2, days) },
      publishedListings: { value: byStatus('published'), share: listings.length ? byStatus('published') / listings.length : 0 },
      pendingApprovals: { value: byStatus('pending') },
      conversations: { value: conversations, previous: null },
      knowledgeDocuments: { value: documents.length, indexed: documents.filter((d) => d.indexingStatus === 'indexed').length },
      activeFeatured: { value: featured.filter((f) => f.status === 'active').length, scheduled: featured.filter((f) => f.status === 'scheduled').length },
    },
    listingGrowth: growth,
    chatbotActivity: daily.map((d) => ({ date: d.date, conversations: d.conversations, fallback: d.unanswered })),
    distribution: ['published', 'pending', 'draft', 'rejected', 'archived'].map((s) => ({ status: s, value: byStatus(s) })),
    popularCategories: categories
      .filter((c) => c.active)
      .map((c) => ({ id: c.id, name: c.name, listings: c.listingCount ?? 0, visits: c.listingCount ?? 0 }))
      .sort((a, b) => b.listings - a.listings)
      .slice(0, 6),
    recentActivity: activity.slice(0, 7),
    topListings: listings.filter((l) => l.status === 'published').sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 6),
    chatbot: {
      conversations,
      questions: Math.round((analytics.chatbot?.messages ?? 0) / 2),
      answered: Math.max(0, conversations - fallback),
      fallback,
      positive: 0,
      negative: 0,
      latencyMs: 0,
    },
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ global search */
export async function globalSearch(query, limitPerGroup = 4) {
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];
  const get = (path) => api(path, { query: { q, pageSize: limitPerGroup } }).then((r) => r.items ?? []);
  const groups = await Promise.allSettled([
    get('/admin/listings').then((items) => ({ type: 'Listings', items: items.map((l) => ({ id: l.id, title: l.name, subtitle: l.shortDescription, to: `/listings/${l.id}` })) })),
    get('/admin/categories').then((items) => ({ type: 'Categories', items: items.map((c) => ({ id: c.id, title: c.name, subtitle: c.description, to: `/categories?view=${c.id}` })) })),
    get('/admin/locations').then((items) => ({ type: 'Locations', items: items.map((l) => ({ id: l.id, title: l.name, subtitle: l.description, to: `/locations?view=${l.id}` })) })),
    get('/admin/knowledge/documents').then((items) => ({ type: 'Knowledge documents', items: items.map((d) => ({ id: d.id, title: d.title, subtitle: d.summary, to: `/knowledge/${d.id}` })) })),
    get('/admin/faqs').then((items) => ({ type: 'FAQs', items: items.map((f) => ({ id: f.id, title: f.question, subtitle: f.answer, to: `/knowledge/faqs?edit=${f.id}` })) })),
    get('/admin/users').then((items) => ({ type: 'Users', items: items.map((u) => ({ id: u.id, title: u.displayName || u.email, subtitle: u.email, to: `/users/${u.id}` })) })),
  ]);
  return groups.filter((g) => g.status === 'fulfilled' && g.value.items.length).map((g) => ({ ...g.value, items: g.value.items.slice(0, limitPerGroup) }));
}
