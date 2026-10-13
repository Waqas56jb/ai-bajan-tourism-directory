/**
 * searchService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./searchService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './searchService.mock';
import * as l0 from './live/opsLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const globalSearch = (...args) => impl('globalSearch')(...args);
