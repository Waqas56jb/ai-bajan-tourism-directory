/**
 * Barbados Trusted Information Network: import the approved websites into the knowledge base.
 *   npm run knowledge:crawl                        (all sites in supabase/seed/crawlSites.json)
 *   npm run knowledge:crawl -- --site alpha.gov    (sites whose start URL contains the text)
 *   npm run knowledge:crawl -- --refresh           (re-check every stored page for changes,
 *                                                  including browser-built sites)
 *
 * - Pages are found from each site's sitemap first (so deep pages such as individual services,
 *   fees and articles are reached), then by following links. `include` / `exclude` patterns keep
 *   to the topics we want; `seeds` are always imported.
 * - Respects robots.txt (User-agent: * rules) and waits between requests.
 * - Sites marked `render` are loaded in headless Chromium (JavaScript-built pages).
 * - Each page is stored as a published, approved document with its URL (for citations) and the
 *   page's own "last updated" date, then queued for indexing. Indexing with embeddings runs in the
 *   deployed API (Admin → Knowledge sync → "Process queue", or the daily cron).
 * - Idempotent: URLs already stored and identical content are skipped.
 */
import { readFileSync } from 'node:fs';
import { env } from '../src/config/env.js';
import { createDatabase } from '../src/database/db.js';
import { checkDueSources, contentHash, plainFetcher, type FetchedPage } from '../src/knowledge/sourceChecker.js';
import { assertPublicUrl, pageUpdatedDate } from '../src/knowledge/urlImport.js';
import { afterSourceWrite } from '../src/sync/syncQueue.js';

interface Site {
  name: string;
  start: string;
  topic: string;
  maxPages: number;
  render?: boolean;
  /** Sitemap URL, or true to read the sitemaps listed in robots.txt (falling back to /sitemap.xml). */
  sitemap?: string | boolean;
  include?: string[];
  exclude?: string[];
  /** Sitemap pages matching these are imported first (the most useful topics for this site). */
  priority?: string[];
  seeds?: string[];
  disabled?: string;
}
const { sites } = JSON.parse(readFileSync(new URL('../supabase/seed/crawlSites.json', import.meta.url), 'utf8')) as { sites: Site[] };
const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const filter = arg('--site');
const db = createDatabase(env().DB_SCHEMA);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = 'AI-Bajan-KnowledgeImporter/1.0 (+contact site admin)';
const SKIP_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|jpe?g|png|gif|webp|svg|mp4|mp3|ics|xml|css|js|json|rss|ashx)(\?|$)/i;
const SKIP_PATH = /\/(wp-admin|wp-login|wp-json|login|signin|register|cart|checkout|account|search|feed|tag|author|my-trip|[a-z-]*membership-login|print|share)\b/i;
/** Translated copies of a site (/fr/, /de/, …): the assistant answers in English from the English pages. */
const SKIP_LANG = /^\/(nl|fr|de|it|pt|es|se|zh|ja)(\/|$)/i;

async function robots(origin: string): Promise<{ disallow: string[]; sitemaps: string[] }> {
  try {
    const r = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': UA } });
    if (!r.ok) return { disallow: [], sitemaps: [] };
    const disallow: string[] = [];
    const sitemaps: string[] = [];
    let applies = false;
    let inAgents = false;
    for (const line of (await r.text()).split(/\r?\n/)) {
      const [k, ...rest] = line.split(':');
      const key = k.trim().toLowerCase();
      const v = rest.join(':').trim();
      if (key === 'user-agent') {
        // Consecutive User-agent lines share one group.
        applies = inAgents ? applies || v === '*' : v === '*';
        inAgents = true;
        continue;
      }
      inAgents = false;
      if (key === 'sitemap' && v) sitemaps.push(v);
      else if (applies && key === 'disallow' && v) disallow.push(v);
    }
    return { disallow, sitemaps };
  } catch {
    return { disallow: [], sitemaps: [] };
  }
}

/** robots.txt path rule: prefix match with `*` wildcards and an optional `$` end anchor. */
const ruleMatches = (rule: string, path: string) =>
  new RegExp('^' + rule.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')).test(path);

async function sitemapUrls(start: string[], host: string): Promise<Array<{ url: string; lastmod: string | null }>> {
  const out = new Map<string, string | null>();
  const queue = [...start];
  const seen = new Set<string>();
  while (queue.length && seen.size < 40) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    try {
      await assertPublicUrl(sm);
      const r = await fetch(sm, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': UA } });
      if (!r.ok) continue;
      const xml = await r.text();
      for (const m of xml.matchAll(/<sitemap>\s*<loc>\s*([^<\s]+)\s*<\/loc>/gi)) queue.push(m[1].replace(/&amp;/g, '&'));
      for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
        const loc = m[1].match(/<loc>\s*([^<\s]+)\s*<\/loc>/i)?.[1]?.replace(/&amp;/g, '&');
        if (!loc) continue;
        try {
          if (new URL(loc).hostname.replace(/^www\./, '') !== host.replace(/^www\./, '')) continue;
        } catch {
          continue;
        }
        out.set(loc.replace(/\/$/, ''), m[1].match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i)?.[1] ?? null);
      }
    } catch {
      /* unreachable sitemap: rely on links */
    }
  }
  return [...out].map(([url, lastmod]) => ({ url, lastmod }));
}

function links(html: string, base: URL): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1].trim().replace(/&amp;/g, '&'), base);
      if (u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '') || !/^https?:$/.test(u.protocol)) continue;
      u.hash = '';
      for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref)/i.test(p)) u.searchParams.delete(p);
      out.add(u.toString().replace(/\/$/, ''));
    } catch {
      /* ignore bad links */
    }
  }
  return [...out];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let browser: any = null;
async function rendered(url: string): Promise<FetchedPage> {
  if (!browser?.isConnected()) {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch();
  }
  await assertPublicUrl(url);
  const page = await browser.newPage({ userAgent: UA });
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
    return { url: page.url(), html, title: (title as string).replace(/\s*[-|]\s*Visit Barbados\s*$/i, ''), text: clean };
  } catch (err) {
    // A crashed browser is replaced on the next page.
    if (/crashed|closed/i.test((err as Error).message)) {
      await browser?.close().catch(() => {});
      browser = null;
    }
    throw err;
  } finally {
    await page.close().catch(() => {});
  }
}

async function crawl(site: Site, totals: { imported: number; skipped: number; failed: number }) {
  const start = new URL(site.start);
  const host = start.hostname;
  const { disallow, sitemaps } = await robots(start.origin);
  const include = (site.include ?? []).map((p) => new RegExp(p, 'i'));
  const exclude = (site.exclude ?? []).map((p) => new RegExp(p, 'i'));
  const priority = (site.priority ?? []).map((p) => new RegExp(p, 'i'));
  const rank = (u: string) => (priority.some((r) => r.test(new URL(u).pathname)) ? 0 : 1);
  const wanted = (u: string) => {
    const path = new URL(u).pathname + new URL(u).search;
    if (SKIP_EXT.test(path) || SKIP_PATH.test(path) || SKIP_LANG.test(path)) return false;
    if (disallow.some((d) => ruleMatches(d, path))) return false;
    if (exclude.some((r) => r.test(path))) return false;
    return !include.length || include.some((r) => r.test(path));
  };
  const stored = new Set(
    (await db.many<{ source_reference: string }>(`select source_reference from ${db.t('knowledge_documents')} where source_reference like $1`, [`%${host.replace(/^www\./, '')}%`])).map((r) =>
      r.source_reference.replace(/\/$/, ''),
    ),
  );

  // Seeds, then sitemap pages (newest first), then the start page for link discovery.
  let fromSitemap: Array<{ url: string; lastmod: string | null }> = [];
  if (site.sitemap) {
    const smList = typeof site.sitemap === 'string' ? [site.sitemap] : sitemaps.length ? sitemaps : [`${start.origin}/sitemap.xml`];
    fromSitemap = (await sitemapUrls(smList, host)).filter((s) => wanted(s.url))
      .sort((a, b) => rank(a.url) - rank(b.url) || (b.lastmod ?? '').localeCompare(a.lastmod ?? ''));
  }
  const lastmod = new Map(fromSitemap.map((s) => [s.url, s.lastmod]));
  const queue = [...(site.seeds ?? []), ...fromSitemap.map((s) => s.url), start.toString()].map((u) => u.replace(/\/$/, ''));
  const seen = new Set(queue);
  let added = 0;
  let visited = 0;
  console.log(
    `\n▶ ${site.name} (${site.start})${fromSitemap.length ? ` — ${fromSitemap.length} relevant page(s) in sitemap` : ''}${disallow.length ? `; robots.txt disallows ${disallow.length} path(s)` : ''}`,
  );
  while (queue.length && added < site.maxPages && visited < site.maxPages * 4) {
    const url = queue.shift()!;
    const isStart = url === start.toString().replace(/\/$/, '');
    // Stored pages are skipped, except the start page: it is still read to find new links.
    if (stored.has(url) && !isStart) {
      totals.skipped++;
      continue;
    }
    visited++;
    try {
      const page = site.render ? await rendered(url) : await plainFetcher(url);
      for (const l of links(page.html, new URL(page.url))) {
        if (!seen.has(l) && seen.size < site.maxPages * 8 && wanted(l)) {
          seen.add(l);
          queue.push(l);
        }
      }
      const finalUrl = page.url.replace(/\/$/, '');
      const { title, text } = page;
      // Link-hub pages (the start page, menus) are followed but only stored if they match the topics.
      if (text.length < 300 || (isStart && include.length && !wanted(url))) continue;
      if (stored.has(finalUrl)) {
        totals.skipped++;
        continue;
      }
      const hash = contentHash(title, text);
      const dup = await db.one(`select 1 from ${db.t('knowledge_documents')} where content_hash = $1`, [hash]);
      if (dup) {
        totals.skipped++;
        continue;
      }
      const updated = pageUpdatedDate(page.html, page.lastModified) ?? (lastmod.get(url) ? String(lastmod.get(url)).slice(0, 10) : null);
      await db.tx(async (client) => {
        const row = await client.query<{ id: string; content_version: number }>(
          `insert into ${db.t('knowledge_documents')}
             (title, summary, content, source_type, source_reference, tags, status, approval_status, visibility, include_in_chatbot,
              content_hash, source_updated_at, last_checked_at)
           values ($1, $2, $3, 'article', $4, $5, 'published', 'approved', 'public', true, $6, $7::date, now()) returning id, content_version`,
          [(title || finalUrl).slice(0, 200), `From ${site.name}`, text.slice(0, 190_000), finalUrl, [site.topic, host.replace(/^www\./, '')], hash, updated],
        );
        await afterSourceWrite(client, db, { sourceType: 'document', sourceId: row.rows[0].id, version: row.rows[0].content_version, eligible: true });
      });
      stored.add(finalUrl);
      added++;
      totals.imported++;
      console.log(`  + ${title.slice(0, 70) || finalUrl} (${text.length.toLocaleString()} chars${updated ? `, updated ${updated}` : ''})`);
    } catch (err) {
      totals.failed++;
      console.log(`  ! ${url}: ${(err as Error).message.slice(0, 80)}`);
    }
    await sleep(600); // be polite to the source websites
  }
  console.log(`  ${added} new page(s) from ${site.name}`);
}

try {
  if (process.argv.includes('--refresh')) {
    const n = (await db.one<{ n: number }>(`select count(*)::int n from ${db.t('knowledge_documents')} where source_reference like 'http%' and status <> 'archived'`))?.n ?? 0;
    console.log(`Checking ${n} stored page(s) for changes…`);
    const out = await checkDueSources(db, { limit: n, budgetMs: 6 * 3600_000, renderedFetcher: rendered, concurrency: 3 });
    console.log(out);
  } else {
    const totals = { imported: 0, skipped: 0, failed: 0 };
    for (const site of sites.filter((s) => !filter || s.start.includes(filter))) {
      if (site.disabled) {
        console.log(`\n– ${site.name}: not imported (${site.disabled})`);
        continue;
      }
      await crawl(site, totals);
    }
    console.log(`\nDone: ${totals.imported} imported, ${totals.skipped} already present/duplicate, ${totals.failed} failed. Pages are queued for indexing.`);
  }
} finally {
  await browser?.close();
  await db.close();
}
