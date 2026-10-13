/**
 * Platform and account settings (DEMO). Stored locally in this browser only; nothing is applied
 * to the live website. Never store secrets here.
 */
import {
  simulate,
  createDocument,
  resetAllCollections,
  getSimulateFailures,
  setSimulateFailures,
} from './mockApi';
import { logActivity } from './activityService';
import { clearDemoStorage } from '@/utils/storage';

export const DEFAULT_GENERAL_SETTINGS = {
  platformName: 'AI Bajan',
  platformDescription: 'A modern guide to Barbados — local business discovery with an AI travel assistant.',
  supportEmail: 'support@example.com',
  publicUrl: 'https://aibajan.example.com',
  locale: 'en-GB',
  timezone: 'America/Barbados',
  country: 'Barbados',
  approvalPolicy:
    'New and edited listings submitted by business owners are reviewed by a moderator before publication.',
  logoText: 'AI Bajan',
  primaryColor: '#0f2a3d',
  secondaryColor: '#e9b872',
  accentColor: '#0d948e',
  defaultListingStatus: 'draft',
  requireApproval: true,
  defaultChatbotVisibility: true,
  defaultSeoVisibility: true,
  defaultFeatured: false,
  notifyNewSubmission: true,
  notifyApproved: true,
  notifyRejected: false,
  notifySyncFailure: true,
  notifyNegativeFeedback: true,
  notifyIncident: true,
  maintenanceMode: false,
};

export const DEFAULT_ACCOUNT_SETTINGS = {
  fullName: 'Alexis Demo',
  email: 'admin.demo@example.com',
  jobTitle: 'Platform lead',
  language: 'English',
  timezone: 'America/Barbados',
  dateFormat: 'DD MMM YYYY',
  theme: 'system',
  emailDigest: 'daily',
  notifyMentions: true,
  notifyAssignments: true,
  avatarColor: '#0d948e',
};

const generalDoc = createDocument('settings', DEFAULT_GENERAL_SETTINGS);
const accountDoc = createDocument('account', DEFAULT_ACCOUNT_SETTINGS);

export const getGeneralSettings = () => simulate(() => generalDoc.get());
export const saveGeneralSettings = (value) =>
  simulate(
    () => {
      generalDoc.set(value);
      logActivity({
        action: 'chatbot_settings',
        entityType: 'settings',
        entityId: 'general',
        entityName: 'Platform settings',
        summary: 'Platform settings saved (local demo configuration).',
      });
      return generalDoc.get();
    },
    { write: true },
  );
export const resetGeneralSettings = () =>
  simulate(() => (generalDoc.reset(), generalDoc.get()), { write: true });

export const getAccountSettings = () => simulate(() => accountDoc.get());
export const saveAccountSettings = (value) =>
  simulate(() => (accountDoc.set(value), accountDoc.get()), { write: true });
/** Synchronous read used for applying the theme on boot. */
export const readAccountSettingsSync = () => accountDoc.get();

export { getSimulateFailures, setSimulateFailures };

/** Restore every demo dataset and setting. Only clears this dashboard's namespaced keys. */
export function resetDemoData() {
  clearDemoStorage();
  resetAllCollections();
}
