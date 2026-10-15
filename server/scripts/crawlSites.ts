/**
 * Crawl the approved websites into the knowledge base (RAG source documents).
 *   npm run knowledge:crawl                       (all sites in supabase/seed/crawlSites.json)
 *   npm run knowledge:crawl -- --site transit246  (sites whose start URL contains the text)
 *
 * - Stays on each site's host, follows links breadth-first up to `maxPages`.
 * - Respects robots.txt (User-agent: * Disallow rules) and waits between requests.
 * - Sites marked `render` are loaded in headless Chromium (JavaScript-built pages).
 * - Each page is stored as a published, approved document with its URL (for citations) and queued
 *   for indexing. Indexing with embeddings runs in the deployed API (Admin → Knowledge sync →
 *   "Process queue", or the daily cron), where the OpenAI key lives.
 * - Idempotent: URLs already stored and identical content are skipped.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { env } from '../src/config/env.js';
import { createDatabase } from '../src/database/db.js';
import { assertPublicUrl, fetchPageRaw, htmlToText } from '../src/knowledge/urlImport.js';
import { afterSourceWrite } from '../src/sync/syncQueue.js';
import { cleanText } from '../src/utils/text.js';

interface Site {
  name: string;
  start: string;
  topic: string;
  maxPages: number;
  render?: boolean;
}
const { sites } = JSON.parse(readFileSync(new URL('../supabase/seed/crawlSites.json', import.meta.url), 'utf8')) as { sites: Site[] };
const filter = process.argv.includes('--site') ? process.argv[process.argv.indexOf('--site') + 1] : null;
const db = createDatabase(env().DB_SCHEMA);
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SKIP_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|webp|svg|mp4|mp3|ics|xml|css|js)(\?|$)/i;
const SKIP_PATH = /\/(wp-admin|wp-login|login|signin|register|cart|checkout|account|search|feed|tag|author|my-trip|[a-z-]*membership-login)\b/i;
/** Translated copies of a site (/fr/, /de/, …): the assistant answers in English from the English pages. */
const SKIP_LANG = /^\/(nl|fr|de|it|pt|es|se|zh|ja)(\/|$)/i;

async function robots(origin: string): Promise<string[]> {
  try {
    const r = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const lines = (await r.text()).split(/\r?\n/);
    const out: string[] = [];
    let applies = false;
    for (const line of lines) {
      const [k, ...rest] = line.split(':');
      const v = rest.join(':').trim();
      if (/^user-agent$/i.test(k.trim())) applies = v === '*';
      else if (applies && /^disallow$/i.test(k.trim()) && v) out.push(v);
    }
    return out;
  } catch {
    return [];
  }
}

function links(html: string, base: URL): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1].trim(), base);
      if (u.host !== base.host || !/^https?:$/.test(u.protocol)) continue;
      u.hash = '';
      for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref)/i.test(p)) u.searchParams.delete(p);
      if (SKIP_EXT.test(u.pathname) || SKIP_PATH.test(u.pathname) || SKIP_LANG.test(u.pathname)) continue;
      out.add(u.toString().replace(/\/$/, ''));
    } catch {
      /* ignore bad links */
    }
  }
  return [...out];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browser: any = null;
async function rendered(url: string): Promise<{ url: string; html: string; title: string; text: string }> {
  if (!browser?.isConnected()) {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch();
  }
  await assertPublicUrl(url);
  const page = await browser.newPage({ userAgent: 'AI-Bajan-KnowledgeImporter/1.0' });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500); // let client-side content render
    const html = await page.content();
    // Visible text without site chrome: these pages build their content client-side, so the
    // browser's rendered text is more reliable than parsing the HTML.
    // (Passed as a string: this code runs in the browser, and the server has no DOM types.)
    const { title, text } = await page.evaluate(`(() => {
      document.querySelectorAll('nav, header, footer, script, style, noscript, [role="navigation"]').forEach((el) => el.remove());
      return { title: document.title, text: document.body.innerText };
    })()`);
    const clean = (text as string).split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 1).join('\n');
    return { url: page.url(), html, title: title.replace(/\s*[-|]\s*Visit Barbados\s*$/i, ''), text: clean };
  } finally {
    await page.close();
  }
}

const totals = { imported: 0, skipped: 0, failed: 0 };
try {
  for (const site of sites.filter((s) => !filter || s.start.includes(filter))) {
    const start = new URL(site.start);
    const disallow = await robots(start.origin);
    const allowed = (u: string) => !disallow.some((d) => new URL(u).pathname.startsWith(d));
    const queue = [start.toString().replace(/\/$/, '')];
    const seen = new Set(queue);
    let stored = 0;
    let visited = 0;
    console.log(`\n▶ ${site.name} (${site.start})${disallow.length ? ` — robots.txt disallows ${disallow.length} path(s)` : ''}`);
    while (queue.length && stored < site.maxPages && visited < site.maxPages * 3) {
      const url = queue.shift()!;
      visited++;
      if (!allowed(url)) continue;
      try {
        const page = site.render ? await rendered(url) : await fetchPageRaw(url).then((p) => ({ url: p.url, html: p.raw, ...htmlToText(p.raw) }));
        for (const l of links(page.html, new URL(page.url))) {
          if (!seen.has(l) && seen.size < site.maxPages * 6) {
            seen.add(l);
            queue.push(l);
          }
        }
        const { title, text } = page;
        if (text.length < 300) continue;
        const exists = await db.one(`select 1 from ${db.t('knowledge_documents')} where source_reference = $1`, [page.url]);
        const hash = sha(`${cleanText(title)}\n${cleanText(text)}`);
        const dup = exists ? null : await db.one(`select 1 from ${db.t('knowledge_documents')} where content_hash = $1`, [hash]);
        if (exists || dup) {
          totals.skipped++;
          continue;
        }
        await db.tx(async (client) => {
          const row = await client.query<{ id: string; content_version: number }>(
            `insert into ${db.t('knowledge_documents')}
               (title, summary, content, source_type, source_reference, tags, status, approval_status, visibility, include_in_chatbot, content_hash)
             values ($1, $2, $3, 'article', $4, $5, 'published', 'approved', 'public', true, $6) returning id, content_version`,
            [(title || page.url).slice(0, 200), `From ${site.name}`, text.slice(0, 190_000), page.url, [site.topic, start.host], hash],
          );
          await afterSourceWrite(client, db, { sourceType: 'document', sourceId: row.rows[0].id, version: row.rows[0].content_version, eligible: true });
        });
        stored++;
        totals.imported++;
        console.log(`  + ${title.slice(0, 70) || page.url} (${text.length.toLocaleString()} chars)`);
      } catch (err) {
        totals.failed++;
        console.log(`  ! ${url}: ${(err as Error).message.slice(0, 80)}`);
        // A crashed browser is replaced on the next rendered page.
        if (/crashed|closed/i.test((err as Error).message)) {
          await browser?.close().catch(() => {});
          browser = null;
        }
      }
      await sleep(600); // be polite to the source websites
    }
    console.log(`  ${stored} page(s) imported from ${site.name}`);
  }
  console.log(`\nDone: ${totals.imported} imported, ${totals.skipped} already present/duplicate, ${totals.failed} failed. Pages are queued for indexing.`);
} finally {
  await browser?.close();
  await db.close();
}
