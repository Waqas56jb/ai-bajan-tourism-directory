/**
 * Business sign-ups and content-provider applications submitted on the public website.
 * Live mode reads them from the API; demo mode has none (sign-ups only exist on the live site).
 */
import { IS_LIVE } from '@/config/environment';
import { api, getAll } from './live/http';

export const getApplications = () => (IS_LIVE ? getAll('/admin/applications') : Promise.resolve([]));

export const updateApplication = (id, changes) =>
  IS_LIVE
    ? api(`/admin/applications/${id}`, { method: 'PATCH', body: changes })
    : Promise.reject(new Error('Applications are only available with the live API.'));
