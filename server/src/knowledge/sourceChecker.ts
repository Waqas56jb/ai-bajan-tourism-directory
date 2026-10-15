import { createHash } from 'node:crypto';
import type { Database } from '../database/db.js';
import { afterSourceWrite } from '../sync/syncQueue.js';
import { AppError } from '../utils/errors.js';
import { cleanText } from '../utils/text.js';
import { fetchPageRaw, htmlToText, pageUpdatedDate } from './urlImport.js';

/**
 * Regular checks for changes on imported web pages (the Trusted Information Network).
 *
 * Each check re-fetches a page and compares its text with what is stored:
 *  - changed   → content, title and the page's update date are replaced and the page is re-indexed
 *  - unchanged → only the check time is recorded
 *  - gone      → after 2 checks in a row that find the page missing (HTTP 404/410), it is archived
 *                and removed from the assistant; temporary errors are retried on the next check
 */
export interface FetchedPage {
  url: string;
  html: string;
  title: string;
  text: string;
  lastModified?: string | null;
}
export type PageFetcher = (url: string) => Promise<FetchedPage>;

export const plainFetcher: PageFetcher = async (url) => {
  const p = await fetchPageRaw(url);
  return { url: p.url, html: p.raw, lastModified: p.lastModified, ...htmlToText(p.raw) };
};

/** Hosts whose pages are built in the browser; they need the crawler's headless browser to re-check. */
export const RENDERED_HOSTS = /(^|\.)visitbarbados\.org$/i;

export type CheckOutcome = 'unchanged' | 'updated' | 'archived' | 'error';

export const contentHash = (title: string, text: string) => createHash('sha256').update(`${cleanText(title)}\n${cleanText(text)}`).digest('hex');

interface DocRow {
  id: string;
  title: string;
  source_reference: string;
  content_hash: string;
  check_failures: number;
}

export async function checkDocument(db: Database, doc: DocRow, fetcher: PageFetcher = plainFetcher): Promise<CheckOutcome> {
  const T = db.t('knowledge_documents');
  let page: FetchedPage;
  try {
    page = await fetcher(doc.source_reference);
  } catch (err) {
    const httpStatus = err instanceof AppError ? (err.details as { httpStatus?: number } | undefined)?.httpStatus : undefined;
    const gone = httpStatus === 404 || httpStatus === 410;
    if (gone && doc.check_failures + 1 >= 2) {
      await db.tx(async (client) => {
        const r = await client.query<{ content_version: number }>(
          `update ${T} set status = 'archived', last_checked_at = now(), check_failures = check_failures + 1, content_version = content_version + 1
            where id = $1 returning content_version`,
          [doc.id],
        );
        await afterSourceWrite(client, db, { sourceType: 'document', sourceId: doc.id, version: r.rows[0].content_version, eligible: false });
      });
      return 'archived';
    }
    await db.query(`update ${T} set last_checked_at = now(), check_failures = check_failures + $2 where id = $1`, [doc.id, gone ? 1 : 0]);
    return 'error';
  }

  const title = (page.title || doc.title).slice(0, 200);
  const text = page.text.slice(0, 190_000);
  const updatedAt = pageUpdatedDate(page.html, page.lastModified);
  // Too little text means the page failed to render or now holds only navigation: keep what we have.
  if (text.length < 300) {
    await db.query(`update ${T} set last_checked_at = now() where id = $1`, [doc.id]);
    return 'error';
  }
  const hash = contentHash(title, text);
  if (hash === doc.content_hash) {
    await db.query(`update ${T} set last_checked_at = now(), check_failures = 0, source_updated_at = coalesce($2::date, source_updated_at) where id = $1`, [doc.id, updatedAt]);
    return 'unchanged';
  }
  await db.tx(async (client) => {
    const r = await client.query<{ content_version: number; status: string; approval_status: string; include_in_chatbot: boolean; visibility: string }>(
      `update ${T} set title = $2, content = $3, content_hash = $4, source_updated_at = coalesce($5::date, current_date),
              last_checked_at = now(), check_failures = 0, content_version = content_version + 1
        where id = $1 returning content_version, status, approval_status, include_in_chatbot, visibility`,
      [doc.id, title, text, hash, updatedAt],
    );
    const d = r.rows[0];
    const eligible = d.status === 'published' && d.approval_status === 'approved' && d.include_in_chatbot && d.visibility === 'public';
    await afterSourceWrite(client, db, { sourceType: 'document', sourceId: doc.id, version: d.content_version, eligible });
  });
  return 'updated';
}

/**
 * Check the pages that have gone longest without a check. `renderedToo` includes browser-built
 * sites (only possible where a headless browser is available, i.e. the crawler scripts).
 */
export async function checkDueSources(
  db: Database,
  opts: { limit: number; budgetMs: number; fetcher?: PageFetcher; renderedFetcher?: PageFetcher; concurrency?: number },
) {
  const rows = await db.many<DocRow>(
    `select id, title, source_reference, content_hash, check_failures from ${db.t('knowledge_documents')}
      where source_reference like 'http%' and status <> 'archived'
      order by last_checked_at nulls first, created_at
      limit $1`,
    [opts.renderedFetcher ? opts.limit : opts.limit * 3],
  );
  const due = rows.filter((d) => opts.renderedFetcher || !RENDERED_HOSTS.test(new URL(d.source_reference).hostname)).slice(0, opts.limit);
  const started = Date.now();
  const totals: Record<CheckOutcome, number> = { unchanged: 0, updated: 0, archived: 0, error: 0 };
  let next = 0;
  const worker = async () => {
    while (next < due.length && Date.now() - started < opts.budgetMs) {
      const d = due[next++];
      const rendered = RENDERED_HOSTS.test(new URL(d.source_reference).hostname);
      totals[await checkDocument(db, d, rendered ? opts.renderedFetcher : (opts.fetcher ?? plainFetcher))]++;
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  return { checked: Object.values(totals).reduce((a, b) => a + b, 0), ...totals, ms: Date.now() - started };
}
