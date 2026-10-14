/**
 * Mock adapter — serves the bundled demo data with a small simulated latency so loading
 * states are visible. Used when VITE_DATA_MODE is "mock" (the default).
 *
 * Nothing here pretends to be a real backend: form submissions resolve with
 * `{ demo: true }` and the UI tells the visitor nothing was sent.
 */
import { mockBusinesses } from '@/data/mockBusinesses';
import { categories } from '@/data/categories';
import { destinations, destinationBySlug } from '@/data/destinations';
import { travelGuides, guideBySlug } from '@/data/travelGuides';
import { searchDirectory } from '@/lib/search';
import { generateMockReply } from '@/lib/chat/mockChatEngine';
import { ApiError } from '@/lib/apiClient';
import { MOCK_LATENCY_MS } from '@/lib/config';

const wait = (ms = MOCK_LATENCY_MS) =>
  ms ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve();

const published = () => mockBusinesses.filter((b) => b.status === 'published');

export const mockAdapter = {
  mode: 'mock',

  async getClassifieds() {
    await wait(0);
    return { items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 };
  },

  async submitClassified() {
    await wait(MOCK_LATENCY_MS ? 600 : 0);
    return { received: true, demo: true };
  },

  async submitApplication() {
    await wait(MOCK_LATENCY_MS ? 700 : 0);
    return { received: true, demo: true };
  },

  async getSignupOptions() {
    return {
      categories: categories.map((c) => ({ id: c.slug, name: c.name })),
      locations: [],
    };
  },

  async getAssistantStatus() {
    return { available: true, welcomeMessage: '', suggestedQuestions: [] };
  },

  async getBusinesses() {
    await wait();
    return published();
  },

  async getBusinessBySlug(slug) {
    await wait();
    const business = published().find((b) => b.slug === slug);
    if (!business)
      throw new ApiError('We couldn’t find that business.', {
        status: 404,
        code: 'NOT_FOUND',
        retryable: false,
      });
    return business;
  },

  async searchBusinesses(filters) {
    await wait();
    return searchDirectory(published(), filters);
  },

  async getCategories() {
    await wait(0);
    return categories;
  },

  async getDestinations() {
    await wait(0);
    return destinations;
  },

  async getDestinationBySlug(slug) {
    await wait(0);
    const destination = destinationBySlug[slug];
    if (!destination)
      throw new ApiError('We couldn’t find that place.', {
        status: 404,
        code: 'NOT_FOUND',
        retryable: false,
      });
    return destination;
  },

  async getTravelGuides() {
    await wait();
    return travelGuides;
  },

  async getGuideBySlug(slug) {
    await wait();
    const guide = guideBySlug[slug];
    if (!guide)
      throw new ApiError('We couldn’t find that guide.', {
        status: 404,
        code: 'NOT_FOUND',
        retryable: false,
      });
    return guide;
  },

  /**
   * Demo chat. Type "simulate failure" to exercise the error + retry UI.
   * @param {{ message: string, history?: object[], context?: object }} payload
   */
  async sendChatMessage(payload) {
    await wait(MOCK_LATENCY_MS ? 900 : 0);
    if (/simulate (a )?(failure|error)/i.test(payload.message ?? '')) {
      throw new ApiError('The assistant couldn’t respond (simulated demo failure).', {
        code: 'SIMULATED',
      });
    }
    return { ...generateMockReply(payload, published()), meta: { mode: 'demo' } };
  },

  async submitContactForm(_payload) {
    await wait(MOCK_LATENCY_MS ? 800 : 0);
    return { ok: true, demo: true };
  },

  async submitNewsletter(_payload) {
    await wait(MOCK_LATENCY_MS ? 700 : 0);
    return { ok: true, demo: true };
  },
};
