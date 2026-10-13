/**
 * Runtime configuration read from Vite env variables. Only public, non-secret values belong
 * here — anything prefixed VITE_ ends up in the browser bundle.
 */
const env = import.meta.env;

export const DATA_MODE = env.VITE_DATA_MODE === 'live' ? 'live' : 'mock';
export const IS_DEMO = DATA_MODE === 'mock';

export const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export const SITE_URL = (env.VITE_SITE_URL || 'https://aibajan.example.com').replace(/\/+$/, '');

export const SITE_NAME = 'AI Bajan';

export const SOCIAL_LINKS = [
  { id: 'instagram', label: 'Instagram', url: env.VITE_SOCIAL_INSTAGRAM },
  { id: 'facebook', label: 'Facebook', url: env.VITE_SOCIAL_FACEBOOK },
  { id: 'x', label: 'X', url: env.VITE_SOCIAL_X },
].filter((s) => typeof s.url === 'string' && /^https:\/\//.test(s.url));

/** Simulated network latency for the mock adapters (0 in tests). */
export const MOCK_LATENCY_MS = env.MODE === 'test' ? 0 : 420;
