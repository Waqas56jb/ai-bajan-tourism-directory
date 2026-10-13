/**
 * advertisingService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./advertisingService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './advertisingService.mock';
import * as l0 from './live/opsLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getAdvertisements = (...args) => impl('getAdvertisements')(...args);
export const getAdvertisementById = (...args) => impl('getAdvertisementById')(...args);
export const createAdvertisement = (...args) => impl('createAdvertisement')(...args);
export const updateAdvertisement = (...args) => impl('updateAdvertisement')(...args);
export const deleteAdvertisement = (...args) => impl('deleteAdvertisement')(...args);
export const getFeaturedPlacements = (...args) => impl('getFeaturedPlacements')(...args);
export const createFeaturedPlacement = (...args) => impl('createFeaturedPlacement')(...args);
export const updateFeaturedPlacement = (...args) => impl('updateFeaturedPlacement')(...args);
export const deleteFeaturedPlacement = (...args) => impl('deleteFeaturedPlacement')(...args);
