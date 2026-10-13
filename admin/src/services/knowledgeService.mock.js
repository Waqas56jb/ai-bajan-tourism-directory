/**
 * Knowledge documents, FAQs and knowledge-sync jobs (DEMO).
 * "Indexing" here only changes status fields in the browser. No vector index exists yet —
 * the Node.js backend will perform chunking, embedding and indexing.
 */
import { db } from './db';
import { simulate, newId, notFound, conflict } from './mockApi';
import { logActivity } from './activityService';

const nowIso = () => new Date().toISOString();

function queueJob(source, sourceType, operation, note) {
  const job = {
    id: newId('job'),
    sourceId: source.id,
    sourceTitle: source.title ?? source.question ?? source.name,
    sourceType,
    operation,
    status: 'pending',
    createdAt: nowIso(),
    completedAt: null,
    retryCount: 0,
    errorSummary: '',
    log: [note ?? 'Queued (simulated)'],
  };
  db.syncJobs.insert(job);
  return job;
}

/* ------------------------------ Documents ------------------------------ */

export const getKnowledgeDocuments = () => simulate(() => db.documents.all());

export const getKnowledgeDocumentById = (id) =>
  simulate(() => {
    const doc = db.documents.find(id);
    if (!doc) throw notFound('Document');
    return { ...doc, jobs: db.syncJobs.all().filter((j) => j.sourceId === id) };
  });

function indexingFor(doc) {
  if (doc.status === 'archived' || !doc.includeInChatbot) return 'excluded';
  if (doc.status !== 'published') return 'not_indexed';
  return 'pending';
}

export const createKnowledgeDocument = (data) =>
  simulate(
    () => {
      if (!data.content?.trim()) throw conflict('Document content can’t be empty.');
      const doc = {
        ...data,
        id: newId('doc'),
        chunkCount: 0,
        lastIndexedAt: null,
        authorId: 'adm-01',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      doc.indexingStatus = indexingFor(doc);
      db.documents.insert(doc);
      if (doc.indexingStatus === 'pending') queueJob(doc, doc.sourceType, 'initial');
      logActivity({
        action: 'document_updated',
        entityType: 'document',
        entityId: doc.id,
        entityName: doc.title,
        summary: `Document created (${doc.status}).`,
      });
      return doc;
    },
    { write: true },
  );

export const updateKnowledgeDocument = (id, data) =>
  simulate(
    () => {
      const existing = db.documents.find(id);
      if (!existing) throw notFound('Document');
      const next = { ...existing, ...data, updatedAt: nowIso() };
      if (!next.content?.trim()) throw conflict('Document content can’t be empty.');
      const status = indexingFor(next);
      next.indexingStatus = status === 'pending' ? 'pending' : status;
      db.documents.patch(id, next);
      if (status === 'pending') queueJob(next, next.sourceType, 'update');
      if (existing.indexingStatus === 'indexed' && status === 'excluded')
        queueJob(next, next.sourceType, 'delete');
      logActivity({
        action: 'document_updated',
        entityType: 'document',
        entityId: id,
        entityName: next.title,
        summary: 'Document updated.',
      });
      return next;
    },
    { write: true },
  );

export const deleteKnowledgeDocument = (id) =>
  simulate(
    () => {
      const doc = db.documents.delete(id);
      logActivity({
        action: 'document_updated',
        entityType: 'document',
        entityId: id,
        entityName: doc.title,
        summary: 'Document deleted.',
      });
      return { id };
    },
    { write: true },
  );

/** Queue / re-queue indexing for a document (simulated). */
export const queueDocumentIndexing = (id, operation = 'reindex') =>
  simulate(
    () => {
      const doc = db.documents.find(id);
      if (!doc) throw notFound('Document');
      if (!doc.includeInChatbot || doc.status !== 'published') {
        throw conflict('Only published documents included in the chatbot can be indexed.');
      }
      db.documents.patch(id, { indexingStatus: 'pending' });
      return queueJob(
        doc,
        doc.sourceType,
        operation,
        `${operation === 'retry' ? 'Retry' : 'Reindex'} requested from admin (simulated)`,
      );
    },
    { write: true },
  );

/* --------------------------------- FAQs -------------------------------- */

export const getFaqs = () => simulate(() => [...db.faqs.all()].sort((a, b) => a.order - b.order));

export const getFaqById = (id) =>
  simulate(() => {
    const faq = db.faqs.find(id);
    if (!faq) throw notFound('FAQ');
    return faq;
  });

function assertPublishable(faq) {
  if (faq.status === 'published' && (!faq.question?.trim() || !faq.answer?.trim())) {
    throw conflict('A published FAQ needs both a question and an answer.');
  }
}

export const createFaq = (data) =>
  simulate(
    () => {
      assertPublishable(data);
      const faq = { ...data, id: newId('faq'), createdAt: nowIso(), updatedAt: nowIso() };
      db.faqs.insert(faq);
      logActivity({
        action: 'faq_updated',
        entityType: 'faq',
        entityId: faq.id,
        entityName: faq.question,
        summary: 'FAQ created.',
      });
      return faq;
    },
    { write: true },
  );

export const updateFaq = (id, data) =>
  simulate(
    () => {
      const existing = db.faqs.find(id);
      if (!existing) throw notFound('FAQ');
      const next = { ...existing, ...data, updatedAt: nowIso() };
      assertPublishable(next);
      db.faqs.patch(id, next);
      logActivity({
        action: 'faq_updated',
        entityType: 'faq',
        entityId: id,
        entityName: next.question,
        summary:
          data.status && data.status !== existing.status
            ? `Status changed to ${data.status}.`
            : 'FAQ updated.',
      });
      return next;
    },
    { write: true },
  );

export const bulkSetFaqStatus = (ids, status) =>
  simulate(
    () => {
      const skipped = [];
      ids.forEach((id) => {
        const faq = db.faqs.find(id);
        if (!faq) return;
        if (status === 'published' && (!faq.question?.trim() || !faq.answer?.trim())) {
          skipped.push(faq.question || id);
          return;
        }
        db.faqs.patch(id, { status, updatedAt: nowIso() });
      });
      logActivity({
        action: 'faq_updated',
        entityType: 'faq',
        entityId: ids.join(','),
        entityName: `${ids.length} FAQs`,
        summary: `Bulk status change to ${status}.`,
      });
      return { updated: ids.length - skipped.length, skipped };
    },
    { write: true },
  );

export const deleteFaq = (id) =>
  simulate(
    () => {
      const faq = db.faqs.delete(id);
      logActivity({
        action: 'faq_updated',
        entityType: 'faq',
        entityId: id,
        entityName: faq.question,
        summary: 'FAQ deleted.',
      });
      return { id };
    },
    { write: true },
  );

/* ------------------------------ Sync jobs ------------------------------ */

export const getSyncJobs = () =>
  simulate(() => [...db.syncJobs.all()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

export const retrySyncJob = (id) =>
  simulate(
    () => {
      const job = db.syncJobs.find(id);
      if (!job) throw notFound('Job');
      if (job.status !== 'failed') throw conflict('Only failed jobs can be retried.');
      const next = db.syncJobs.patch(id, {
        status: 'pending',
        retryCount: job.retryCount + 1,
        errorSummary: '',
        completedAt: null,
        log: [...job.log, `Retry ${job.retryCount + 1} queued from admin (simulated)`],
      });
      const doc = db.documents.find(job.sourceId);
      if (doc) db.documents.patch(doc.id, { indexingStatus: 'pending' });
      return next;
    },
    { write: true },
  );

/**
 * "Refresh" the demo queue: advances simulated jobs one step (pending → running → completed)
 * so the interface can be exercised. This does not represent real processing.
 */
export const refreshSyncQueue = () =>
  simulate(
    () => {
      let advanced = 0;
      db.syncJobs.all().forEach((job) => {
        if (job.status === 'running') {
          advanced += 1;
          db.syncJobs.patch(job.id, {
            status: 'completed',
            completedAt: nowIso(),
            log: [...job.log, 'Completed (simulated)'],
          });
          const doc = db.documents.find(job.sourceId);
          if (doc && job.operation !== 'delete')
            db.documents.patch(doc.id, {
              indexingStatus: 'indexed',
              lastIndexedAt: nowIso(),
              chunkCount: Math.max(1, Math.round((doc.content?.length ?? 400) / 220)),
            });
          const listing = db.listings.find(job.sourceId);
          if (listing && job.operation !== 'delete')
            db.listings.patch(listing.id, {
              ai: { ...listing.ai, indexingStatus: 'indexed', lastIndexedAt: nowIso() },
            });
        } else if (job.status === 'pending') {
          advanced += 1;
          db.syncJobs.patch(job.id, { status: 'running', log: [...job.log, 'Started (simulated)'] });
          const doc = db.documents.find(job.sourceId);
          if (doc) db.documents.patch(doc.id, { indexingStatus: 'processing' });
        }
      });
      return { advanced };
    },
    { write: true },
  );
