/**
 * categoryService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./categoryService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './categoryService.mock';
import * as l0 from './live/directoryLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getCategories = (...args) => impl('getCategories')(...args);
export const getCategoryById = (...args) => impl('getCategoryById')(...args);
export const createCategory = (...args) => impl('createCategory')(...args);
export const updateCategory = (...args) => impl('updateCategory')(...args);
export const deleteCategory = (...args) => impl('deleteCategory')(...args);
