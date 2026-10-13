import { Router, type Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { AppContext } from '../app/context.js';
import { recordAudit } from '../audit/auditService.js';
import { hasPermission } from '../auth/permissions.js';
import type { Database, Queryable } from '../database/db.js';
import { buildSet, likeEscape } from '../database/sqlBuilder.js';
import { requirePermission } from '../middleware/auth.js';
import { body, csv, paged, paginationQuery, params, query, uuidParam, validate, formatZodIssues, searchText } from '../middleware/core.js';
import { afterSourceWrite, isDocumentEligible } from '../sync/syncQueue.js';
import { AppError, badRequest, conflict, forbidden, notFound, validationError } from '../utils/errors.js';
import { cleanText, sha256 } from '../utils/text.js';
import { ExtractionError, extractText, MAX_UPLOAD_BYTES, safeFileName } from './fileExtraction.js';

const DOC_STATUSES = ['draft', 'review', 'published', 'archived'] as const;
const SOURCE_TYPES = ['guide', 'article', 'policy', 'upload'] as const;
const optionalId = z.union([z.uuid(), z.null()]);

const docFields = {
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(1000).optional(),
  content: z.string().max(200000).optional(),
  sourceType: z.enum(SOURCE_TYPES).optional(),
  sourceReference: z.string().trim().max(500).optional(),
  categoryId: optionalId.optional(),
  locationId: optionalId.optional(),
  relatedListingId: optionalId.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  status: z.enum(DOC_STATUSES).optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected']).optional(),
  visibility: z.enum(['public', 'internal']).optional(),
  includeInChatbot: z.boolean().optional(),
};
const COLUMNS = {
  title: 'title',
  summary: 'summary',
  content: 'content',
  sourceType: 'source_type',
  sourceReference: 'source_reference',
  categoryId: 'category_id',
  locationId: 'location_id',
  relatedListingId: 'related_listing_id',
  tags: 'tags',
  status: 'status',
  approvalStatus: 'approval_status',
  visibility: 'visibility',
  includeInChatbot: 'include_in_chatbot',
  contentHash: 'content_hash',
  fileName: 'file_name',
  fileMime: 'file_mime',
  fileSize: 'file_size_bytes',
  extractionStatus: 'extraction_status',
};

interface DocRow {
  id: string;
  title: string;
  summary: string;
  content: string;
  source_type: string;
  source_reference: string;
  category_id: string | null;
  location_id: string | null;
  related_listing_id: string | null;
  tags: string[];
  status: string;
  approval_status: string;
  visibility: string;
  include_in_chatbot: boolean;
  file_name: string;
  file_mime: string;
  file_size_bytes: number | null;
  extraction_status: string;
  extraction_error: string;
  content_hash: string;
  content_version: number;
  created_at: Date;
  updated_at: Date;
  index_status?: string | null;
  last_indexed_at?: Date | null;
  chunk_count?: number | null;
  indexed_version?: number | null;
  index_error?: string | null;
}

export const toDocument = (r: DocRow, includeContent = true) => ({
  id: r.id,
  title: r.title,
  summary: r.summary,
  ...(includeContent ? { content: r.content } : { contentLength: r.content.length }),
  sourceType: r.source_type,
  sourceReference: r.source_reference,
  categoryId: r.category_id,
  locationId: r.location_id,
  relatedListingId: r.related_listing_id,
  tags: r.tags,
  status: r.status,
  approvalStatus: r.approval_status,
  visibility: r.visibility,
  includeInChatbot: r.include_in_chatbot,
  file: r.file_name ? { name: r.file_name, mime: r.file_mime, size: r.file_size_bytes, extractionStatus: r.extraction_status } : null,
  indexingStatus: r.index_status ?? 'not_indexed',
  lastIndexedAt: r.last_indexed_at ?? null,
  chunkCount: r.chunk_count ?? 0,
  indexedVersion: r.indexed_version ?? null,
  indexingError: r.index_error || null,
  version: r.content_version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const select = (db: Database) => `
  select d.*, s.status as index_status, s.last_indexed_at, s.chunk_count, s.indexed_version, s.last_error as index_error
    from ${db.t('knowledge_documents')} d
    left join ${db.t('index_state')} s on s.source_type = 'document' and s.source_id = d.id`;

async function load(q: Queryable, db: Database, id: string) {
  const r = await q.query<DocRow>(`${select(db)} where d.id = $1`, [id]);
  if (!r.rowCount) throw notFound('Knowledge document');
  return r.rows[0];
}

function checkPublishRights(req: Request, b: { status?: string; approvalStatus?: string }) {
  const publishing = b.status === 'published' || b.approvalStatus !== undefined;
  if (publishing && !hasPermission(req.admin?.role, 'knowledge:publish')) throw forbidden('Publishing or approving requires the knowledge:publish permission.');
  if (b.status === 'published' && b.approvalStatus === undefined) b.approvalStatus = 'approved';
}

const hashOf = (title: string, content: string) => sha256(`${cleanText(title)}\n${cleanText(content)}`);

async function insertDocument(ctx: AppContext, req: Request, values: Record<string, unknown> & { title: string; content?: string }) {
  const { db } = ctx;
  const contentHash = hashOf(values.title, values.content ?? '');
  return db.tx(async (client) => {
    // Duplicate detection on exact content.
    if ((values.content ?? '').trim()) {
      const dup = await client.query<{ id: string; title: string }>(`select id, title from ${db.t('knowledge_documents')} where content_hash = $1 limit 1`, [contentHash]);
      if (dup.rowCount) throw conflict(`This content already exists in "${dup.rows[0].title}".`, { existingId: dup.rows[0].id });
    }
    const { sets, params: p } = buildSet({ ...values, contentHash }, COLUMNS);
    const cols = sets.map((s) => s.split(' = ')[0]);
    p.push(req.admin?.id ?? null, req.admin?.id ?? null);
    const id = (
      await client.query<{ id: string }>(
        `insert into ${db.t('knowledge_documents')} (${[...cols, 'created_by', 'updated_by'].join(', ')}) values (${p.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
        p,
      )
    ).rows[0].id;
    const doc = await load(client, db, id);
    await afterSourceWrite(client, db, { sourceType: 'document', sourceId: id, version: doc.content_version, eligible: isDocumentEligible(doc), requestedBy: req.admin?.id });
    await recordAudit(client, db, req, { action: 'document.created', entityType: 'document', entityId: id, entityName: doc.title });
    return load(client, db, id);
  });
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 } });

export function documentRoutes(ctx: AppContext) {
  const r = Router();
  const { db } = ctx;

  r.get(
    '/',
    requirePermission('knowledge:read'),
    validate({
      query: z.strictObject({
        ...paginationQuery,
        q: searchText(120).optional(),
        status: csv(z.enum(DOC_STATUSES)).optional(),
        indexingStatus: z.string().trim().max(20).optional(),
      }),
    }),
    async (req, res) => {
      const f = query<{ page: number; pageSize: number; q?: string; status?: string[]; indexingStatus?: string }>(req);
      const where: string[] = [];
      const p: unknown[] = [];
      if (f.q) {
        p.push(`%${likeEscape(f.q)}%`);
        where.push(`d.title ilike $${p.length} escape '\\'`);
      }
      if (f.status?.length) {
        p.push(f.status);
        where.push(`d.status = any($${p.length})`);
      }
      if (f.indexingStatus) {
        p.push(f.indexingStatus);
        where.push(`coalesce(s.status, 'not_indexed') = $${p.length}`);
      }
      const w = where.length ? `where ${where.join(' and ')}` : '';
      const total = await db.one<{ n: number }>(
        `select count(*)::int as n from ${db.t('knowledge_documents')} d left join ${db.t('index_state')} s on s.source_type = 'document' and s.source_id = d.id ${w}`,
        p,
      );
      const rows = await db.many<DocRow>(`${select(db)} ${w} order by d.updated_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, p);
      res.json(paged(rows.map((d) => toDocument(d, false)), total?.n ?? 0, f.page, f.pageSize));
    },
  );

  r.get('/:id', requirePermission('knowledge:read'), validate({ params: uuidParam }), async (req, res) => {
    res.json(toDocument(await load(db, db, params<{ id: string }>(req).id)));
  });

  /** Chunk text as indexed (no vectors) — for "what does the chatbot actually see?" diagnostics. */
  r.get('/:id/chunks', requirePermission('knowledge:read'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    await load(db, db, id);
    const rows = await db.many(
      `select chunk_index as "index", chunk_kind as kind, chunk_text as text, is_active as active, source_version as version,
              embedding_model as "embeddingModel", (embedding is not null) as "hasEmbedding", created_at as "createdAt"
         from ${db.t('knowledge_chunks')} where source_type = 'document' and source_id = $1 order by source_version desc, chunk_index limit 500`,
      [id],
    );
    res.json({ items: rows });
  });

  r.post('/', requirePermission('knowledge:write'), validate({ body: z.strictObject(docFields) }), async (req, res) => {
    const b = body<Record<string, unknown> & { title: string; content?: string; status?: string; approvalStatus?: string }>(req);
    checkPublishRights(req, b);
    res.status(201).json(toDocument(await insertDocument(ctx, req, b)));
  });

  r.post('/upload', requirePermission('knowledge:write'), upload.single('file'), async (req, res) => {
    if (!req.file) throw badRequest('Attach a file in the "file" field.');
    const meta = z
      .strictObject({
        title: z.string().trim().min(3).max(200).optional(),
        summary: z.string().trim().max(1000).optional(),
        categoryId: z.uuid().optional(),
        locationId: z.uuid().optional(),
      })
      .safeParse(req.body ?? {});
    if (!meta.success) throw validationError(formatZodIssues(meta.error));
    const fileName = safeFileName(req.file.originalname);
    let extracted: { text: string; mime: string };
    try {
      extracted = extractText(fileName, req.file.buffer);
    } catch (err) {
      if (err instanceof ExtractionError) throw new AppError(err.code === 'TOO_LARGE' ? 413 : 415, err.code, err.message);
      throw err;
    }
    const doc = await insertDocument(ctx, req, {
      ...meta.data,
      title: meta.data.title ?? fileName.replace(/\.[^.]+$/, ''),
      content: extracted.text,
      sourceType: 'upload',
      status: 'draft',
      fileName,
      fileMime: extracted.mime,
      fileSize: req.file.size,
      extractionStatus: 'extracted',
    });
    res.status(201).json(toDocument(doc));
  });

  r.patch(
    '/:id',
    requirePermission('knowledge:write'),
    validate({ params: uuidParam, body: z.strictObject({ ...docFields, title: docFields.title.optional(), expectedVersion: z.number().int().min(1).optional() }) }),
    async (req, res) => {
      const id = params<{ id: string }>(req).id;
      const b = body<Record<string, unknown> & { title?: string; content?: string; status?: string; approvalStatus?: string; expectedVersion?: number }>(req);
      checkPublishRights(req, b);
      const doc = await db.tx(async (client) => {
        const current = (await client.query<DocRow>(`select * from ${db.t('knowledge_documents')} where id = $1 for update`, [id])).rows[0];
        if (!current) throw notFound('Knowledge document');
        if (b.expectedVersion && b.expectedVersion !== current.content_version) {
          throw conflict('This document was changed by someone else. Reload it first.', { currentVersion: current.content_version });
        }
        const { expectedVersion: _ignored, ...changes } = b;
        const contentHash = hashOf(b.title ?? current.title, b.content ?? current.content);
        const { sets, params: p } = buildSet({ ...changes, contentHash }, COLUMNS);
        await client.query(
          `insert into ${db.t('content_revisions')} (entity_type, entity_id, version, snapshot, created_by) values ('document', $1, $2, $3, $4) on conflict do nothing`,
          [id, current.content_version, JSON.stringify(toDocument(current)), req.admin?.id ?? null],
        );
        p.push(req.admin?.id ?? null, id);
        await client.query(
          `update ${db.t('knowledge_documents')} set ${sets.join(', ')}, updated_by = $${p.length - 1}, content_version = content_version + 1 where id = $${p.length}`,
          p,
        );
        const updated = await load(client, db, id);
        await afterSourceWrite(client, db, { sourceType: 'document', sourceId: id, version: updated.content_version, eligible: isDocumentEligible(updated), requestedBy: req.admin?.id });
        await recordAudit(client, db, req, {
          action: b.status && b.status !== current.status ? `document.${b.status}` : 'document.updated',
          entityType: 'document',
          entityId: id,
          entityName: updated.title,
        });
        return load(client, db, id);
      });
      res.json(toDocument(doc));
    },
  );

  r.post('/:id/reindex', requirePermission('sync:manage'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    const job = await db.tx(async (client) => {
      const doc = await load(client, db, id);
      // Clearing the stored hash forces the worker to rebuild chunks and embeddings.
      await client.query(`update ${db.t('index_state')} set indexed_hash = null where source_type = 'document' and source_id = $1`, [id]);
      const j = await afterSourceWrite(client, db, { sourceType: 'document', sourceId: id, version: doc.content_version, eligible: isDocumentEligible(doc), requestedBy: req.admin?.id });
      await recordAudit(client, db, req, { action: 'document.reindex_requested', entityType: 'document', entityId: id, entityName: doc.title });
      return j;
    });
    res.status(202).json({ jobId: job.id, coalesced: job.coalesced, message: 'Re-indexing has been queued. It runs in the background worker.' });
  });

  r.delete('/:id', requirePermission('knowledge:write'), validate({ params: uuidParam }), async (req, res) => {
    const id = params<{ id: string }>(req).id;
    await db.tx(async (client) => {
      const doc = (await client.query<DocRow>(`delete from ${db.t('knowledge_documents')} where id = $1 returning *`, [id])).rows[0];
      if (!doc) throw notFound('Knowledge document');
      await afterSourceWrite(client, db, { sourceType: 'document', sourceId: id, version: doc.content_version + 1, eligible: false, deleted: true, requestedBy: req.admin?.id });
      await recordAudit(client, db, req, { action: 'document.deleted', entityType: 'document', entityId: id, entityName: doc.title });
    });
    res.status(204).end();
  });

  return r;
}
