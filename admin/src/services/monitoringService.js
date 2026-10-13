/**
 * monitoringService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./monitoringService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './monitoringService.mock';
import * as l0 from './live/opsLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getSystemHealth = (...args) => impl('getSystemHealth')(...args);
export const getErrorLogs = (...args) => impl('getErrorLogs')(...args);
export const updateErrorLog = (...args) => impl('updateErrorLog')(...args);
export const getNotifications = (...args) => impl('getNotifications')(...args);
export const markNotificationRead = (...args) => impl('markNotificationRead')(...args);
export const markAllNotificationsRead = (...args) => impl('markAllNotificationsRead')(...args);
