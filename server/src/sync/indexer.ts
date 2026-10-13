import type { Database } from '../database/db.js';
import type { LlmProvider } from '../llm/provider.js';
import { sha256 } from '../utils/text.js';
import { currentVersion, loadSource } from './sourceDocuments.js';
import type { SourceType } from './syncQueue.js';

export interface IndexJob {
  id: string;
  source_type: SourceType;
  source_id: string;
  operation: 'upsert' | 'delete';
  source_version: number;
}

export type IndexOutcome =
  | { status: 'completed'; result: Record<string, unknown> }
  | { status: 'superseded'; result: Record<string, unknown> };

const toVectorLiteral = (v: number[]) => `[${v.map((x) => (Number.isFinite(x) ? x : 0)).join(',')}]`;

async function removeSource(db: Database, type: SourceType, id: string, status: 'removed' | 'excluded') {
  return db.tx(async (client) => {
    const del = await client.query(`delete from ${db.t('knowledge_chunks')} where source_type = $1 and source_id = $2`, [type, id]);
    await client.query(
      `insert into ${db.t('index_state')} (source_type, source_id, status, chunk_count, last_error)
       values ($1, $2, $3, 0, '')
       on conflict (source_type, source_id) do update set status = $3, chunk_count = 0, indexed_hash = null,
         last_error = '', updated_at = now()`,
      [type, id, status],
    );
    return del.rowCount ?? 0;
  });
}

/**
 * Process one sync job. Throws on failures that should be retried (e.g. embedding API errors);
 * returns 'superseded' when a newer version of the source appeared while this job was running.
 */
export async function processIndexJob(db: Database, llm: LlmProvider, job: IndexJob): Promise<IndexOutcome> {
  const type = job.source_type;
  const id = job.source_id;

  const source = job.operation === 'delete' ? null : await loadSource(db, db, type, id);
  if (!source || !source.exists) {
    const removed = await removeSource(db, type, id, 'removed');
    return { status: 'completed', result: { action: 'removed', chunksRemoved: removed } };
  }
  if (!source.eligible) {
    // Not published/approved/included: make sure nothing remains retrievable.
    const removed = await removeSource(db, type, id, 'excluded');
    return { status: 'completed', result: { action: 'excluded', chunksRemoved: removed, version: source.version } };
  }
  if (!source.chunks.length) {
    await removeSource(db, type, id, 'excluded');
    return { status: 'completed', result: { action: 'excluded', reason: 'no indexable text', version: source.version } };
  }

  const hash = sha256(JSON.stringify([source.chunks, source.categoryIds.sort(), source.locationIds.sort(), source.metadata]));
  const state = await db.one<{ indexed_hash: string | null; status: string; embedding_model: string | null; indexed_version: number | null }>(
    `select indexed_hash, status, embedding_model, indexed_version from ${db.t('index_state')} where source_type = $1 and source_id = $2`,
    [type, id],
  );
  const embeddingsWanted = llm.available;
  const unchanged =
    state?.indexed_hash === hash &&
    ((state.status === 'indexed' && state.embedding_model === llm.embeddingModel) || (state.status === 'keyword_only' && !embeddingsWanted) ||
      (state.status === 'pending' && state.embedding_model === (embeddingsWanted ? llm.embeddingModel : null)));

  if (unchanged) {
    // Same text as already indexed (e.g. only private notes changed): just move the version forward.
    const moved = await db.tx(async (client) => {
      const now = await currentVersion(client, db, type, id);
      if (now !== source.version) return false;
      await client.query(
        `update ${db.t('knowledge_chunks')} set source_version = $3, is_active = true where source_type = $1 and source_id = $2`,
        [type, id, source.version],
      );
      await client.query(
        `update ${db.t('index_state')} set indexed_version = $3, status = $4, last_error = '', updated_at = now()
          where source_type = $1 and source_id = $2`,
        [type, id, source.version, embeddingsWanted ? 'indexed' : 'keyword_only'],
      );
      return true;
    });
    if (!moved) return { status: 'superseded', result: { reason: 'source changed during processing' } };
    return { status: 'completed', result: { action: 'unchanged', version: source.version } };
  }

  // Embeddings are generated BEFORE the write transaction (network call); failures throw → retry.
  const texts = source.chunks.map((c) => c.text);
  const vectors = embeddingsWanted ? await llm.embed(texts) : null;

  const written = await db.tx(async (client) => {
    await client.query(
      `insert into ${db.t('index_state')} (source_type, source_id, status) values ($1, $2, 'processing') on conflict do nothing`,
      [type, id],
    );
    const locked = await client.query<{ indexed_version: number | null }>(
      `select indexed_version from ${db.t('index_state')} where source_type = $1 and source_id = $2 for update`,
      [type, id],
    );
    // A stale worker must never overwrite newer content.
    const now = await currentVersion(client, db, type, id);
    if (now !== source.version) return { superseded: true as const, reason: `source is now at version ${now}` };
    const indexedVersion = locked.rows[0]?.indexed_version;
    if (indexedVersion !== null && indexedVersion !== undefined && indexedVersion > source.version) {
      return { superseded: true as const, reason: `version ${indexedVersion} is already indexed` };
    }

    await client.query(`delete from ${db.t('knowledge_chunks')} where source_type = $1 and source_id = $2`, [type, id]);
    for (let i = 0; i < source.chunks.length; i++) {
      const c = source.chunks[i];
      await client.query(
        `insert into ${db.t('knowledge_chunks')}
           (source_type, source_id, source_version, chunk_index, chunk_kind, title, chunk_text, content_hash,
            embedding, embedding_model, category_ids, location_ids, metadata, is_active)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9::extensions.vector,$10,$11,$12,$13,true)`,
        [
          type,
          id,
          source.version,
          i,
          c.kind,
          c.title.slice(0, 300),
          c.text,
          sha256(c.text),
          vectors ? toVectorLiteral(vectors[i]) : null,
          vectors ? llm.embeddingModel : null,
          source.categoryIds,
          source.locationIds,
          JSON.stringify(source.metadata),
        ],
      );
    }
    await client.query(
      `update ${db.t('index_state')} set status = $3, indexed_version = $4, indexed_hash = $5, embedding_model = $6,
              chunk_count = $7, last_indexed_at = now(), last_error = '', updated_at = now()
        where source_type = $1 and source_id = $2`,
      [type, id, vectors ? 'indexed' : 'keyword_only', source.version, hash, vectors ? llm.embeddingModel : null, source.chunks.length],
    );
    return { superseded: false as const };
  });

  if (written.superseded) return { status: 'superseded', result: { reason: written.reason } };

  // Verify what was committed rather than assuming success.
  const check = await db.one<{ n: number; embedded: number }>(
    `select count(*)::int as n, count(embedding)::int as embedded from ${db.t('knowledge_chunks')}
      where source_type = $1 and source_id = $2 and source_version = $3 and is_active`,
    [type, id, source.version],
  );
  if (!check || check.n !== source.chunks.length || (vectors && check.embedded !== source.chunks.length)) {
    throw new Error(`Index verification failed: expected ${source.chunks.length} chunks, found ${check?.n ?? 0}`);
  }
  return {
    status: 'completed',
    result: {
      action: 'indexed',
      version: source.version,
      chunks: check.n,
      embedded: check.embedded,
      mode: vectors ? 'hybrid' : 'keyword_only',
      ...(vectors ? {} : { note: 'Embeddings skipped: OPENAI_API_KEY is not configured. Keyword retrieval only.' }),
    },
  };
}
