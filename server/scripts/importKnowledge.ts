/**
 * Import the curated knowledge sources into the knowledge base and index them.
 *   npm run knowledge:import                 (DB_SCHEMA from .env)
 *   npm run knowledge:import -- --no-index   (import only; the worker/cron indexes later)
 *
 * Idempotent: a URL that is already stored (source_reference) is skipped. Pages are stored as
 * published + approved "article" documents with their URL kept for citations.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { env } from '../src/config/env.js';
import { createDatabase } from '../src/database/db.js';
import { fetchPageText } from '../src/knowledge/urlImport.js';
import { OpenAiProvider } from '../src/llm/openaiProvider.js';
import { afterSourceWrite } from '../src/sync/syncQueue.js';
import { SyncWorker } from '../src/sync/syncWorker.js';
import { cleanText } from '../src/utils/text.js';

const { sources } = JSON.parse(readFileSync(new URL('../supabase/seed/knowledgeSources.json', import.meta.url), 'utf8')) as {
  sources: Array<{ topic: string; url: string }>;
};
const db = createDatabase(env().DB_SCHEMA);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const summary = { imported: 0, skipped: 0, failed: [] as string[] };

try {
  for (const s of sources) {
    const exists = await db.one(`select id from ${db.t('knowledge_documents')} where source_reference = $1`, [s.url]);
    if (exists) {
      summary.skipped++;
      continue;
    }
    try {
      const page = await fetchPageText(s.url);
      const title = (page.title || s.url).replace(/\s+-\s+Wikipedia$/i, '').slice(0, 200);
      await db.tx(async (client) => {
        const row = await client.query<{ id: string; content_version: number }>(
          `insert into ${db.t('knowledge_documents')}
             (title, summary, content, source_type, source_reference, tags, status, approval_status, visibility, include_in_chatbot, content_hash)
           values ($1, $2, $3, 'article', $4, $5, 'published', 'approved', 'public', true, $6)
           returning id, content_version`,
          [title, `Imported from ${new URL(page.url).hostname} (${s.topic})`, page.text, page.url, [s.topic], sha(`${cleanText(title)}\n${cleanText(page.text)}`)],
        );
        await afterSourceWrite(client, db, { sourceType: 'document', sourceId: row.rows[0].id, version: row.rows[0].content_version, eligible: true });
      });
      summary.imported++;
      console.log(`  imported  ${title} (${page.text.length.toLocaleString()} chars)`);
    } catch (err) {
      summary.failed.push(`${s.url}: ${(err as Error).message}`);
      console.log(`  FAILED    ${s.url}: ${(err as Error).message}`);
    }
  }
  console.log(`Imported ${summary.imported}, skipped ${summary.skipped} (already present), failed ${summary.failed.length}.`);

  if (!process.argv.includes('--no-index')) {
    const worker = new SyncWorker(db, new OpenAiProvider(), { leaseSeconds: 600, batchSize: 5, workerId: 'knowledge-import' });
    let total = 0;
    for (;;) {
      const n = await worker.runOnce();
      total += n;
      if (!n) break;
      process.stdout.write(`\r  indexed ${total} job(s)…`);
    }
    await worker.heartbeat();
    const stats = await db.one<{ docs: number; chunks: number }>(
      `select (select count(*)::int from ${db.t('knowledge_documents')} where status = 'published') as docs,
              (select count(*)::int from ${db.t('knowledge_chunks')} where is_active and source_type = 'document') as chunks`,
    );
    console.log(`\nIndexing done: ${stats!.docs} published documents, ${stats!.chunks} active chunks.`);
  }
} finally {
  await db.close();
}
