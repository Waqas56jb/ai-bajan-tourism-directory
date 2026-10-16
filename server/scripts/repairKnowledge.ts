/**
 * Repairs imported web pages already in the knowledge base, then queues changed pages for
 * re-indexing (the deployed API generates the embeddings):
 *  - mis-decoded characters ("countryâ€™s" → "country’s");
 *  - site-wide titles ("GOV.BB", "Business Barbados", "Facebook-color") → the page's own heading;
 *  - news items and announcements tagged "news" and dated from their byline.
 *
 *   npm run knowledge:repair              (apply)
 *   npm run knowledge:repair -- --dry-run (show what would change)
 */
import { env } from '../src/config/env.js';
import { createDatabase } from '../src/database/db.js';
import { betterTitle, isNewsPage, newsDate, repairMojibake } from '../src/knowledge/pageCleanup.js';
import { contentHash } from '../src/knowledge/sourceChecker.js';
import { afterSourceWrite, isDocumentEligible } from '../src/sync/syncQueue.js';

const dry = process.argv.includes('--dry-run');
const db = createDatabase(env().DB_SCHEMA);
const T = db.t('knowledge_documents');
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

interface Doc {
  id: string;
  title: string;
  content: string;
  source_reference: string;
  source_updated_at: Date | string | null;
  tags: string[];
}

try {
  const docs = await db.many<Doc>(`select id, title, content, source_reference, source_updated_at, tags from ${T} where source_reference like 'http%' and status <> 'archived'`);
  // Titles used by three or more pages of the same site are site-wide, not page titles.
  const perHost = new Map<string, Map<string, number>>();
  for (const d of docs) {
    const h = hostOf(d.source_reference);
    const m = perHost.get(h) ?? new Map<string, number>();
    m.set(d.title.toLowerCase(), (m.get(d.title.toLowerCase()) ?? 0) + 1);
    perHost.set(h, m);
  }
  const siteTitles = new Map([...perHost].map(([h, m]) => [h, new Set([...m].filter(([, n]) => n >= 3).map(([t]) => t))]));

  const totals = { checked: docs.length, titles: 0, characters: 0, news: 0, dated: 0, updated: 0 };
  for (const d of docs) {
    const content = repairMojibake(d.content);
    const title = betterTitle(repairMojibake(d.title), content, { siteTitles: siteTitles.get(hostOf(d.source_reference)), url: d.source_reference }).slice(0, 200);
    const news = isNewsPage(d.source_reference, title, content);
    const tags = news && !d.tags.includes('news') ? [...d.tags, 'news'] : d.tags;
    const date = d.source_updated_at ? null : news ? newsDate(content) : null;
    const changed = content !== d.content || title !== d.title || tags !== d.tags || date;
    if (!changed) continue;
    if (content !== d.content) totals.characters++;
    if (title !== d.title) totals.titles++;
    if (tags !== d.tags) totals.news++;
    if (date) totals.dated++;
    if (dry) {
      if (title !== d.title) console.log(`  title: "${d.title}" → "${title}"  (${d.source_reference.slice(0, 80)})`);
      continue;
    }
    await db.tx(async (client) => {
      const r = await client.query(
        `update ${T} set title = $2, content = $3, tags = $4, source_updated_at = coalesce(source_updated_at, $5::date), content_hash = $6,
                content_version = content_version + 1, updated_at = now()
          where id = $1 returning *`,
        [d.id, title, content, tags, date, contentHash(title, content)],
      );
      const row = r.rows[0];
      await afterSourceWrite(client, db, { sourceType: 'document', sourceId: d.id, version: row.content_version, eligible: isDocumentEligible(row) });
    });
    totals.updated++;
  }
  console.log(dry ? 'Dry run (nothing changed):' : 'Repaired:', totals);
} finally {
  await db.close();
}
