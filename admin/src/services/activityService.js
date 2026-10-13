import { db } from './db';
import { simulate, newId } from './mockApi';
import { getSessionAdmin } from './authService';

export const getActivityLogs = () => simulate(() => db.activity.all());

/**
 * Record a demo activity event (called by other services after successful writes).
 * Browser-side only — the real audit trail must be written by the backend.
 */
export function logActivity({ action, entityType, entityId, entityName, summary, status = 'success' }) {
  db.activity.insert({
    id: newId('evt'),
    at: new Date().toISOString(),
    actor: getSessionAdmin()?.name ?? 'Demo administrator',
    action,
    entityType,
    entityId,
    entityName,
    summary,
    status,
  });
}
