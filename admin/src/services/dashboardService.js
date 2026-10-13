/**
 * dashboardService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./dashboardService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './dashboardService.mock';
import * as l0 from './live/opsLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getDashboardStats = (...args) => impl('getDashboardStats')(...args);
