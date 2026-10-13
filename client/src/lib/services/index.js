/**
 * Service facade used by hooks. Components never import adapters directly.
 * Switch adapters with VITE_DATA_MODE ("mock" | "live").
 */
import { DATA_MODE } from '@/lib/config';
import { mockAdapter } from './mockAdapter';
import { liveAdapter } from './liveAdapter';

export const api = DATA_MODE === 'live' ? liveAdapter : mockAdapter;

export const {
  getBusinesses,
  getBusinessBySlug,
  searchBusinesses,
  getCategories,
  getDestinations,
  getDestinationBySlug,
  getTravelGuides,
  getGuideBySlug,
  sendChatMessage,
  submitContactForm,
  submitNewsletter,
  getAssistantStatus,
  submitApplication,
  getSignupOptions,
} = api;
