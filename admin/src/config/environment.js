/** Frontend-safe configuration. Only public values belong here — never secrets. */
const env = import.meta.env;

export const DATA_MODE = env.VITE_DATA_MODE === 'live' ? 'live' : 'mock';
export const IS_DEMO = DATA_MODE === 'mock';
export const API_BASE_URL = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
export const PUBLIC_SITE_URL = (env.VITE_PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/+$/, '');

const rate = Number(env.VITE_MOCK_FAILURE_RATE);
export const MOCK_FAILURE_RATE = Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 0;
export const MOCK_LATENCY_MS = env.MODE === 'test' ? 0 : 320;
