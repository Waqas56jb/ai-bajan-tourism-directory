/**
 * settingsService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./settingsService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './settingsService.mock';
import * as l0 from './live/opsLive';

const live = IS_LIVE ? { ...l0.makeGeneralSettings(mock.DEFAULT_GENERAL_SETTINGS) } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const resetDemoData = (...args) => impl('resetDemoData')(...args);
export const DEFAULT_GENERAL_SETTINGS = impl('DEFAULT_GENERAL_SETTINGS');
export const DEFAULT_ACCOUNT_SETTINGS = impl('DEFAULT_ACCOUNT_SETTINGS');
export const getGeneralSettings = (...args) => impl('getGeneralSettings')(...args);
export const saveGeneralSettings = (...args) => impl('saveGeneralSettings')(...args);
export const resetGeneralSettings = (...args) => impl('resetGeneralSettings')(...args);
export const getAccountSettings = (...args) => impl('getAccountSettings')(...args);
export const saveAccountSettings = (...args) => impl('saveAccountSettings')(...args);
export const readAccountSettingsSync = (...args) => impl('readAccountSettingsSync')(...args);
export const getSimulateFailures = (...args) => impl('getSimulateFailures')(...args);
export const setSimulateFailures = (...args) => impl('setSimulateFailures')(...args);
