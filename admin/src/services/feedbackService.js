/**
 * feedbackService — facade. VITE_DATA_MODE=live calls the AI Bajan API (./live/*);
 * otherwise the in-browser demo implementation in ./feedbackService.mock.js is used.
 * Generated: keep page imports pointing at this file.
 */
import { IS_LIVE } from '@/config/environment';
import * as mock from './feedbackService.mock';
import * as l0 from './live/opsLive';

const live = IS_LIVE ? { ...l0 } : {};
const impl = (n) => (n in live ? live[n] : mock[n]);

export const getFeedback = (...args) => impl('getFeedback')(...args);
export const updateFeedback = (...args) => impl('updateFeedback')(...args);
export const addFeedbackNote = (...args) => impl('addFeedbackNote')(...args);
