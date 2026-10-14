/**
 * Jobs & classified ads submitted on the public website, and the questions report.
 * Live mode reads them from the API; demo mode has none (they only exist on the live site).
 */
import { IS_LIVE } from '@/config/environment';
import { api, getAll } from './live/http';

const liveOnly = () => Promise.reject(new Error('This is only available with the live API.'));

export const getClassifieds = () => (IS_LIVE ? getAll('/admin/classifieds') : Promise.resolve([]));

/** status: approved | rejected | pending; expiresAt: YYYY-MM-DD (approval defaults to 30 days). */
export const updateClassified = (id, changes) => (IS_LIVE ? api(`/admin/classifieds/${id}`, { method: 'PATCH', body: changes }) : liveOnly());

export const deleteClassified = (id) => (IS_LIVE ? api(`/admin/classifieds/${id}`, { method: 'DELETE' }) : liveOnly());

const EMPTY_REPORT = { days: 90, totals: { questions: 0, uniqueQuestions: 0, poorlyAnswered: 0, noAnswer: 0 }, top: [], poor: [], intents: [] };

/** Most-asked questions and the ones the assistant answered poorly (anonymous question log). */
export const getQuestionsReport = (days = 90) =>
  IS_LIVE ? api('/admin/analytics/questions', { query: { days, limit: 50 } }) : Promise.resolve({ ...EMPTY_REPORT, days });
