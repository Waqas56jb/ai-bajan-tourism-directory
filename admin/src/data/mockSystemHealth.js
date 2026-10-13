import { daysAgo, minutesAgo } from './helpers';

/**
 * DEMO system health. NOTHING here is a live check — no service is contacted. Each card shows
 * "Not connected" until the backend exposes a real status endpoint.
 */
const S = (id, description, demoStatus, link, incidents = []) => ({
  id,
  description,
  demoStatus, // 'operational' | 'degraded' | 'outage' — sample values only
  connection: 'not_connected',
  lastCheckedAt: null,
  link,
  incidents,
});

export const mockServices = [
  S('public_site', 'Visitor-facing React website.', 'operational', '/monitoring/errors?service=public_site'),
  S('admin', 'This admin dashboard (running in demo mode).', 'operational', '/settings/general'),
  S(
    'api',
    'Future Node.js API for listings, search, forms and chat.',
    'operational',
    '/monitoring/errors?service=api',
    [{ id: 'inc-1', at: daysAgo(3, 14), text: 'Sample: elevated latency on /search for 12 min.' }],
  ),
  S('supabase', 'Future database, auth and storage.', 'operational', '/monitoring/errors?service=supabase'),
  S(
    'openai',
    'Language model provider used by the RAG service.',
    'degraded',
    '/monitoring/errors?service=openai',
    [{ id: 'inc-2', at: daysAgo(1, 9), text: 'Sample: intermittent 429 rate-limit responses.' }],
  ),
  S(
    'rag',
    'Retrieval pipeline: search approved knowledge, build grounded answers.',
    'operational',
    '/chatbot',
    [{ id: 'inc-3', at: daysAgo(5, 20), text: 'Sample: retrieval returned no sources for 3 queries.' }],
  ),
  S(
    'sync',
    'Keeps listings, FAQs and documents in sync with the knowledge index.',
    'degraded',
    '/knowledge/sync',
    [{ id: 'inc-4', at: minutesAgo(12), text: 'Sample: 2 indexing jobs failed.' }],
  ),
  S('files', 'Extracts text from uploaded PDF, DOCX, TXT and CSV files.', 'operational', '/knowledge'),
];

export const mockIncidentHistory = Array.from({ length: 14 }, (_, i) => {
  const day = 13 - i;
  const pattern = [0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 3, 1, 2];
  return {
    date: daysAgo(day),
    incidents: pattern[i],
    resolved: Math.max(0, pattern[i] - (day === 0 ? 1 : 0)),
  };
});

const L = (id, at, severity, service, category, message, ref, status = 'open', details = '') => ({
  id,
  at,
  severity,
  service,
  category,
  message,
  reference: ref,
  status,
  details:
    details ||
    `Sample stack-free summary for ${id}. Real error payloads will come from the backend; secrets and personal data must never be logged here.`,
});

export const mockErrorLogs = [
  L('err-9012', minutesAgo(12), 'error', 'sync', 'indexing', 'Chunking timed out for doc-004', 'job-1042'),
  L(
    'err-9011',
    minutesAgo(130),
    'warning',
    'openai',
    'rate_limit',
    'Provider returned 429 — request retried',
    'req-7f3a',
  ),
  L(
    'err-9010',
    daysAgo(0, 6),
    'error',
    'sync',
    'external',
    'Embedding provider rate limited (doc-007)',
    'job-1041',
  ),
  L(
    'err-9009',
    daysAgo(1, 22),
    'info',
    'api',
    'validation',
    'Contact form rejected: invalid email',
    'req-6b21',
    'reviewed',
  ),
  L(
    'err-9008',
    daysAgo(1, 18),
    'warning',
    'rag',
    'retrieval',
    'No sources above relevance threshold',
    'conv-2313',
  ),
  L(
    'err-9007',
    daysAgo(2, 11),
    'critical',
    'api',
    'timeout',
    'Search endpoint exceeded 10 s',
    'req-5e90',
    'reviewed',
  ),
  L(
    'err-9006',
    daysAgo(2, 9),
    'error',
    'files',
    'indexing',
    'Unsupported file encoding in upload',
    'doc-upload-77',
  ),
  L('err-9005', daysAgo(3, 15), 'warning', 'public_site', 'external', 'Image CDN slow response', 'img-cdn'),
  L(
    'err-9004',
    daysAgo(4, 13),
    'error',
    'supabase',
    'timeout',
    'Connection pool exhausted (sample)',
    'db-pool',
    'reviewed',
  ),
  L(
    'err-9003',
    daysAgo(5, 20),
    'warning',
    'rag',
    'retrieval',
    'Low-confidence answer returned with fallback',
    'conv-2311',
  ),
  L(
    'err-9002',
    daysAgo(6, 13),
    'error',
    'openai',
    'external',
    'Model request failed (sample 500)',
    'conv-2307',
  ),
  L(
    'err-9001',
    daysAgo(8, 10),
    'info',
    'api',
    'validation',
    'Listing payload missing category',
    'req-3c11',
    'reviewed',
  ),
];

export const mockNotifications = [
  {
    id: 'ntf-1',
    title: 'Indexing job failed',
    body: 'Getting around Barbados — 3 attempts (sample).',
    at: minutesAgo(12),
    to: '/knowledge/sync',
    read: false,
    tone: 'danger',
  },
  {
    id: 'ntf-2',
    title: 'New listing submitted',
    body: 'Sunset Rum Shack is waiting for review.',
    at: minutesAgo(48),
    to: '/listings/submissions',
    read: false,
    tone: 'info',
  },
  {
    id: 'ntf-3',
    title: 'Negative chatbot feedback',
    body: 'Conversation conv-2315 was rated unhelpful.',
    at: daysAgo(1, 11),
    to: '/chatbot/conversations/conv-2315',
    read: false,
    tone: 'warning',
  },
  {
    id: 'ntf-4',
    title: 'Campaign ending soon',
    body: '“Taste the island” ends in 3 days.',
    at: daysAgo(1, 9),
    to: '/advertising',
    read: true,
    tone: 'warning',
  },
  {
    id: 'ntf-5',
    title: 'New feedback report',
    body: 'Broken website link reported for Pelican Craft Collective.',
    at: daysAgo(0, 7),
    to: '/feedback',
    read: true,
    tone: 'info',
  },
];
