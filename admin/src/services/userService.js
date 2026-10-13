/**
 * userService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./userService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './userService.mock';
import * as l0 from './live/opsLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getUsers = (...args) => impl('getUsers')(...args);
export const getUserById = (...args) => impl('getUserById')(...args);
export const updateUser = (...args) => impl('updateUser')(...args);
export const getAdministrators = (...args) => impl('getAdministrators')(...args);
export const getAdministratorById = (...args) => impl('getAdministratorById')(...args);
export const inviteAdministrator = (...args) => impl('inviteAdministrator')(...args);
export const updateAdministrator = (...args) => impl('updateAdministrator')(...args);
