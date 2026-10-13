/**
 * knowledgeService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./knowledgeService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './knowledgeService.mock';
import * as l0 from './live/knowledgeLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getKnowledgeDocuments = (...args) => impl('getKnowledgeDocuments')(...args);
export const getKnowledgeDocumentById = (...args) => impl('getKnowledgeDocumentById')(...args);
export const createKnowledgeDocument = (...args) => impl('createKnowledgeDocument')(...args);
export const updateKnowledgeDocument = (...args) => impl('updateKnowledgeDocument')(...args);
export const deleteKnowledgeDocument = (...args) => impl('deleteKnowledgeDocument')(...args);
export const queueDocumentIndexing = (...args) => impl('queueDocumentIndexing')(...args);
export const getFaqs = (...args) => impl('getFaqs')(...args);
export const getFaqById = (...args) => impl('getFaqById')(...args);
export const createFaq = (...args) => impl('createFaq')(...args);
export const updateFaq = (...args) => impl('updateFaq')(...args);
export const bulkSetFaqStatus = (...args) => impl('bulkSetFaqStatus')(...args);
export const deleteFaq = (...args) => impl('deleteFaq')(...args);
export const getSyncJobs = (...args) => impl('getSyncJobs')(...args);
export const retrySyncJob = (...args) => impl('retrySyncJob')(...args);
export const refreshSyncQueue = (...args) => impl('refreshSyncQueue')(...args);
/** Import a page from a trusted website (live mode only — the API fetches and extracts it). */
export const importDocumentFromUrl = (...args) =>
  IS_LIVE ? l0.importDocumentFromUrl(...args) : Promise.reject(new Error('Importing from websites requires the live API.'));
