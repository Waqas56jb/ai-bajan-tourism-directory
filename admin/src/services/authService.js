/**
 * authService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./authService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './authService.mock';
import * as l0 from './live/authLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getSession = (...args) => impl('getSession')(...args);
export const getSessionAdmin = (...args) => impl('getSessionAdmin')(...args);
export const login = (...args) => impl('login')(...args);
export const logout = (...args) => impl('logout')(...args);
export const requestPasswordReset = (...args) => impl('requestPasswordReset')(...args);
export const DEMO_ACCOUNT_EMAIL = impl('DEMO_ACCOUNT_EMAIL');
