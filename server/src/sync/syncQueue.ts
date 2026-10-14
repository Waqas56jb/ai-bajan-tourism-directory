import type { Database, Queryable } from '../database/db.js';

export type SourceType = 'listing' | 'faq' | 'document' | 'classified';

/**
 * Queue a synchronisation job. At most one *pending* job exists per source (partial unique index),
 * so repeated edits coalesce: the pending job is updated to the newest version instead of piling up.
 * Must be called in the same transaction as the source change so the two commit together.
 */
export async function enqueueSync(
  q: Queryable,
  db: Database,
  job: { sourceType: SourceType; sourceId: string; operation: 'upsert' | 'delete'; version: number; requestedBy?: string | null },
): Promise<{ id: string; coalesced: boolean }> {
  const t = db.t('sync_jobs');
  const r = await q.query<{ id: string; inserted: boolean }>(
    `insert into ${t} (source_type, source_id, operation, source_version, requested_by)
     values ($1, $2, $3, $4, $5)
     on conflict (source_type, source_id) where status = 'pending'
     do update set operation = excluded.operation,
                   source_version = greatest(${t}.source_version, excluded.source_version),
                   next_run_at = least(${t}.next_run_at, now()),
                   attempts = 0,
                   last_error = ''
     returning id, (xmax = 0) as inserted`,
    [job.sourceType, job.sourceId, job.operation, job.version, job.requestedBy ?? null],
  );
  await q.query(
    `insert into ${db.t('index_state')} (source_type, source_id, status) values ($1, $2, 'pending')
     on conflict (source_type, source_id) do update set status = 'pending', updated_at = now()`,
    [job.sourceType, job.sourceId],
  );
  return { id: r.rows[0].id, coalesced: !r.rows[0].inserted };
}

/**
 * Immediately make a source's chunks ineligible for retrieval (unpublish/archive/delete/exclude).
 * This happens synchronously in the caller's transaction; the queued job then cleans up.
 */
export async function deactivateChunks(q: Queryable, db: Database, sourceType: SourceType, sourceId: string) {
  const r = await q.query(
    `update ${db.t('knowledge_chunks')} set is_active = false where source_type = $1 and source_id = $2 and is_active`,
    [sourceType, sourceId],
  );
  return r.rowCount ?? 0;
}

// ------------------------------------------------------------------ eligibility rules (single source of truth)
export const isListingEligible = (l: { status: string; include_in_chatbot: boolean }) =>
  l.status === 'published' && l.include_in_chatbot;

export const isFaqEligible = (f: { status: string; approval_status: string; include_in_chatbot: boolean }) =>
  f.status === 'published' && f.approval_status === 'approved' && f.include_in_chatbot;

export const isDocumentEligible = (d: {
  status: string;
  approval_status: string;
  include_in_chatbot: boolean;
  visibility: string;
  content: string;
}) =>
  d.status === 'published' &&
  d.approval_status === 'approved' &&
  d.include_in_chatbot &&
  d.visibility === 'public' &&
  d.content.trim().length > 0;

/** Approved and not past its expiry date. */
export const isClassifiedEligible = (c: { status: string; expires_at: string | null }) =>
  c.status === 'approved' && (!c.expires_at || String(c.expires_at).slice(0, 10) >= new Date().toISOString().slice(0, 10));

/** Apply the right chunk/queue side effects after a source write. */
export async function afterSourceWrite(
  q: Queryable,
  db: Database,
  args: { sourceType: SourceType; sourceId: string; version: number; eligible: boolean; deleted?: boolean; requestedBy?: string | null },
) {
  if (args.deleted || !args.eligible) await deactivateChunks(q, db, args.sourceType, args.sourceId);
  return enqueueSync(q, db, {
    sourceType: args.sourceType,
    sourceId: args.sourceId,
    operation: args.deleted ? 'delete' : 'upsert',
    version: args.version,
    requestedBy: args.requestedBy,
  });
}
