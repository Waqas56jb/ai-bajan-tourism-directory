/** Live knowledge documents, FAQs and sync jobs. Indexing is performed by the API's worker. */
import { api, getAll, isUuid, compact } from './http';
import { mapIndexStatus } from './directoryLive';

const idOrNull = (v) => (isUuid(v) ? v : null);
const SOURCE_TYPES = new Set(['guide', 'article', 'policy', 'upload']);

/* ------------------------------------------------------------------ documents */
export function fromServerDocument(d) {
  return {
    ...d,
    content: d.content ?? '',
    relatedFaqId: null,
    requiresApproval: d.approvalStatus !== 'approved',
    indexingStatus: mapIndexStatus(d.indexingStatus),
    file: d.file ? { name: d.file.name, size: d.file.size, type: d.file.mime } : null,
    authorId: null,
    sourceUrl: /^https?:\/\//i.test(d.sourceReference ?? '') ? d.sourceReference : '',
  };
}

const toServerDocument = (v) =>
  compact({
    title: v.title,
    summary: v.summary ?? undefined,
    content: v.content ?? undefined,
    sourceType: v.sourceType === undefined ? undefined : SOURCE_TYPES.has(v.sourceType) ? v.sourceType : 'article',
    sourceReference: typeof v.sourceUrl === 'string' ? v.sourceUrl : undefined,
    categoryId: v.categoryId === undefined ? undefined : idOrNull(v.categoryId),
    locationId: v.locationId === undefined ? undefined : idOrNull(v.locationId),
    relatedListingId: v.relatedListingId === undefined ? undefined : idOrNull(v.relatedListingId),
    tags: Array.isArray(v.tags) ? v.tags : undefined,
    status: v.status,
    visibility: v.visibility,
    includeInChatbot: typeof v.includeInChatbot === 'boolean' ? v.includeInChatbot : undefined,
  });

export async function getKnowledgeDocuments() {
  return (await getAll('/admin/knowledge/documents')).map(fromServerDocument);
}

export async function getKnowledgeDocumentById(id) {
  const [doc, jobs] = await Promise.all([api(`/admin/knowledge/documents/${id}`), api('/admin/sync/jobs', { query: { sourceId: id, pageSize: 50 } })]);
  return { ...fromServerDocument(doc), jobs: (jobs?.items ?? []).map(fromServerJob) };
}

export async function createKnowledgeDocument(data) {
  return fromServerDocument(await api('/admin/knowledge/documents', { method: 'POST', body: toServerDocument(data) }));
}

export async function updateKnowledgeDocument(id, data) {
  return fromServerDocument(await api(`/admin/knowledge/documents/${id}`, { method: 'PATCH', body: toServerDocument(data) }));
}

export async function deleteKnowledgeDocument(id) {
  await api(`/admin/knowledge/documents/${id}`, { method: 'DELETE' });
  return { id };
}

export async function queueDocumentIndexing(id) {
  const res = await api(`/admin/knowledge/documents/${id}/reindex`, { method: 'POST' });
  return { id: res?.jobId, status: 'pending' };
}

/** Import a page from a trusted website into the knowledge base (the API fetches and extracts it). */
export async function importDocumentFromUrl({ url, title, categoryId, publish = false }) {
  return fromServerDocument(
    await api('/admin/knowledge/documents/import-url', {
      method: 'POST',
      body: compact({ url, title: title || undefined, categoryId: idOrNull(categoryId) ?? undefined, publish }),
      timeout: 60000,
    }),
  );
}

/* ------------------------------------------------------------------ FAQs */
const fromServerFaq = (f) => ({ ...f, listingId: f.relatedListingId ?? null, indexingStatus: mapIndexStatus(f.indexingStatus) });
const toServerFaq = (v) =>
  compact({
    question: v.question,
    answer: v.answer,
    categoryId: v.categoryId === undefined ? undefined : idOrNull(v.categoryId),
    locationId: v.locationId === undefined ? undefined : idOrNull(v.locationId),
    relatedListingId: v.listingId === undefined ? undefined : idOrNull(v.listingId),
    tags: Array.isArray(v.tags) ? v.tags : undefined,
    status: v.status === undefined ? undefined : v.status === 'review' ? 'draft' : v.status,
    includeInChatbot: typeof v.includeInChatbot === 'boolean' ? v.includeInChatbot : undefined,
    order: Number.isFinite(Number(v.order)) && v.order !== '' && v.order !== undefined ? Number(v.order) : undefined,
    sourceUrl: typeof v.sourceUrl === 'string' ? v.sourceUrl.trim() : undefined,
    sourceTitle: typeof v.sourceTitle === 'string' ? v.sourceTitle.trim() : undefined,
    reviewDue: v.reviewDue ? String(v.reviewDue).slice(0, 10) : undefined,
    withdrawalReason: v.withdrawalReason || undefined,
  });

export async function getFaqs() {
  return (await getAll('/admin/faqs')).map(fromServerFaq).sort((a, b) => a.order - b.order);
}
export async function getFaqById(id) {
  return fromServerFaq(await api(`/admin/faqs/${id}`));
}
export async function createFaq(data) {
  return fromServerFaq(await api('/admin/faqs', { method: 'POST', body: toServerFaq(data) }));
}
export async function updateFaq(id, data) {
  return fromServerFaq(await api(`/admin/faqs/${id}`, { method: 'PATCH', body: toServerFaq(data) }));
}
export async function bulkSetFaqStatus(ids, status) {
  const res = await api('/admin/faqs/bulk-status', { method: 'POST', body: { ids, status: status === 'review' ? 'draft' : status } });
  return { updated: res?.affected ?? 0, skipped: [] };
}
export async function deleteFaq(id) {
  await api(`/admin/faqs/${id}`, { method: 'DELETE' });
  return { id };
}

/* ------------------------------------------------------------------ sync jobs */
const OPERATION = { upsert: 'update', delete: 'delete' };
export function fromServerJob(j) {
  const r = j.result ?? {};
  const log = [
    `Queued ${new Date(j.createdAt).toLocaleString()}`,
    j.startedAt && `Started ${new Date(j.startedAt).toLocaleString()}`,
    r.action && `Result: ${r.action}${r.chunks ? ` (${r.chunks} chunks, ${r.mode})` : ''}`,
    r.note,
    j.lastError && `Error: ${j.lastError}`,
    j.status === 'superseded' && 'Superseded by a newer change to the same source.',
  ].filter(Boolean);
  return {
    id: j.id,
    sourceId: j.sourceId,
    sourceTitle: j.sourceTitle ?? '(deleted source)',
    sourceType: j.sourceType === 'document' ? 'article' : j.sourceType,
    operation: OPERATION[j.operation] ?? j.operation,
    status: j.status === 'superseded' ? 'completed' : j.status,
    createdAt: j.createdAt,
    completedAt: j.completedAt,
    retryCount: Math.max(0, (j.attempts ?? 1) - 1),
    errorSummary: j.lastError ?? '',
    log,
  };
}

export async function getSyncJobs() {
  const res = await api('/admin/sync/jobs', { query: { pageSize: 100 } });
  return (res?.items ?? []).map(fromServerJob);
}
export async function retrySyncJob(id) {
  const res = await api(`/admin/sync/jobs/${id}/retry`, { method: 'POST' });
  return { id: res?.jobId, status: 'pending' };
}
/** Process queued jobs now (runs the API's indexing worker for a short, time-boxed batch). */
export async function refreshSyncQueue() {
  const res = await api('/admin/sync/run', { method: 'POST', timeout: 60000 });
  return { advanced: res?.processed ?? 0, remaining: res?.remainingPending ?? 0 };
}
