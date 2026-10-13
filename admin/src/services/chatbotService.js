/**
 * chatbotService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./chatbotService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './chatbotService.mock';
import * as l0 from './live/opsLive';

const live = IS_LIVE ? { ...l0, ...l0.makeChatbotSettings(mock.DEFAULT_CHATBOT_SETTINGS) } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getConversations = (...args) => impl('getConversations')(...args);
export const getConversationById = (...args) => impl('getConversationById')(...args);
export const setConversationReview = (...args) => impl('setConversationReview')(...args);
export const addConversationNote = (...args) => impl('addConversationNote')(...args);
export const getChatbotStats = (...args) => impl('getChatbotStats')(...args);
export const DEFAULT_CHATBOT_SETTINGS = impl('DEFAULT_CHATBOT_SETTINGS');
export const getChatbotSettings = (...args) => impl('getChatbotSettings')(...args);
export const saveChatbotSettings = (...args) => impl('saveChatbotSettings')(...args);
export const resetChatbotSettings = (...args) => impl('resetChatbotSettings')(...args);
