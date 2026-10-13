/**
 * listingService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./listingService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './listingService.mock';
import * as l0 from './live/directoryLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const isSlugTaken = (...args) => impl('isSlugTaken')(...args);
export const suggestSlug = (...args) => impl('suggestSlug')(...args);
export const getListings = (...args) => impl('getListings')(...args);
export const getListingById = (...args) => impl('getListingById')(...args);
export const createListing = (...args) => impl('createListing')(...args);
export const updateListing = (...args) => impl('updateListing')(...args);
export const setListingStatus = (...args) => impl('setListingStatus')(...args);
export const bulkSetListingStatus = (...args) => impl('bulkSetListingStatus')(...args);
export const toggleListingFeatured = (...args) => impl('toggleListingFeatured')(...args);
export const deleteListing = (...args) => impl('deleteListing')(...args);
export const bulkDeleteListings = (...args) => impl('bulkDeleteListings')(...args);
export const setListingVerified = (...args) => impl('setListingVerified')(...args);
