import type { Request } from 'express';
import type { Database, Queryable } from '../database/db.js';

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  summary?: string;
  changes?: Record<string, unknown>;
  status?: 'success' | 'failure';
}

/** Write an audit row, normally inside the same transaction as the change it describes. */
export async function recordAudit(q: Queryable, db: Database, req: Request, entry: AuditEntry) {
  await q.query(
    `insert into ${db.t('audit_logs')}
       (actor_admin_id, actor_label, action, entity_type, entity_id, entity_name, summary, changes, status, request_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      req.admin?.id ?? null,
      req.admin ? req.admin.displayName || req.admin.email : 'system',
      entry.action,
      entry.entityType,
      entry.entityId ?? '',
      (entry.entityName ?? '').slice(0, 200),
      (entry.summary ?? '').slice(0, 500),
      JSON.stringify(entry.changes ?? {}),
      entry.status ?? 'success',
      req.requestId ?? '',
    ],
  );
}

/** Field names whose values changed (values themselves are not stored — they may be long or private). */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
}
