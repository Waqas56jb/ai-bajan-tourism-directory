/**
 * locationService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./locationService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './locationService.mock';
import * as l0 from './live/directoryLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getLocations = (...args) => impl('getLocations')(...args);
export const getLocationById = (...args) => impl('getLocationById')(...args);
export const createLocation = (...args) => impl('createLocation')(...args);
export const updateLocation = (...args) => impl('updateLocation')(...args);
export const deleteLocation = (...args) => impl('deleteLocation')(...args);
