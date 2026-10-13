/**
 * Live adapter — calls the future AI Bajan Node.js API. Enabled with VITE_DATA_MODE=live.
 *
 * Expected endpoints (to be implemented by the server team; adjust paths here only):
 *   GET  /businesses?q&category&location&type&amenities&featured&sort&page&pageSize
 *        → { items, total, page, pageCount, pageSize, facets }
 *   GET  /businesses/all                 → Business[]
 *   GET  /businesses/:slug               → Business
 *   GET  /categories                     → Category[]
 *   GET  /destinations                   → Destination[]
 *   GET  /destinations/:slug             → Destination
 *   GET  /guides                         → Guide[]
 *   GET  /guides/:slug                   → Guide
 *   POST /chat        { message, history, context } → { reply, businesses, sources, followUps, meta }
 *   POST /contact     { name, email, subject, message, topic } → { ok }
 *   POST /newsletter  { email, consent }  → { ok }
 *
 * There is deliberately no fallback to mock data: if the API fails, the UI shows an error.
 */
import { apiClient } from '@/lib/apiClient';

const enc = encodeURIComponent;

export const liveAdapter = {
  mode: 'live',
  getBusinesses: () => apiClient.get('/businesses/all'),
  getBusinessBySlug: (slug) => apiClient.get(`/businesses/${enc(slug)}`),
  searchBusinesses: (filters, { signal } = {}) =>
    apiClient.get('/businesses', { query: filters, signal }),
  getCategories: () => apiClient.get('/categories'),
  getDestinations: () => apiClient.get('/destinations'),
  getDestinationBySlug: (slug) => apiClient.get(`/destinations/${enc(slug)}`),
  getTravelGuides: () => apiClient.get('/guides'),
  getGuideBySlug: (slug) => apiClient.get(`/guides/${enc(slug)}`),
  sendChatMessage: (payload) => apiClient.post('/chat', payload, { timeout: 45000 }),
  submitContactForm: (payload) => apiClient.post('/contact', payload),
  submitNewsletter: (payload) => apiClient.post('/newsletter', payload),
};
