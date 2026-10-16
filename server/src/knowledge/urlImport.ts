import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError, badRequest } from '../utils/errors.js';
import { cleanText } from '../utils/text.js';

/**
 * Fetch a public web page and turn it into clean knowledge-base text.
 *
 * SSRF protection: only http(s) on standard ports, no credentials, every hostname (including each
 * redirect hop) must resolve exclusively to public IP addresses. Size and time are bounded.
 */
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw badRequest('Enter a valid URL.', { field: 'url' });
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw badRequest('Only public http(s) URLs can be imported.', { field: 'url' });
  if (url.port && !['80', '443'].includes(url.port)) throw badRequest('Only standard web ports are allowed.', { field: 'url' });
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw badRequest('That address is not public.', { field: 'url' });
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw badRequest('That website could not be found.', { field: 'url' });
  if (addresses.some((a) => isPrivateIp(a.address))) throw badRequest('That address is not public.', { field: 'url' });
  return url;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };
const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

/** HTML → markdown-ish text: headings kept (so chunks follow sections), boilerplate removed. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  // The page's main content: the <main>/<article> block with the most text. Many sites repeat
  // <article> for sidebar cards, so the first one is not necessarily the page itself; when even
  // the largest block holds little of the page's text, use the whole body.
  const whole = html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html;
  const visible = (s: string) => s.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').length;
  const blocks = [...html.matchAll(/<(main|article)\b[\s\S]*?<\/\1>/gi)].map((m) => ({ html: m[0], size: visible(m[0]) }));
  const best = blocks.sort((a, b) => b.size - a.size)[0];
  let body = best && best.size >= 0.25 * visible(whole) ? best.html : whole;
  body = body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe|aside|button|select)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, l, t) => `\n\n${'#'.repeat(Math.min(Number(l), 3))} ${t.replace(/<[^>]+>/g, ' ').trim()}\n\n`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/section|\/article|\/blockquote|\/ul|\/ol|\/table)[^>]*>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');
  const lines = cleanText(decode(body))
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(-|\|)?\s*$/.test(l));
  // Stop at reference/navigation sections and drop citation debris ("Retrieved …", "^ …").
  const END = /^#{1,3}\s*(references|notes|citations|sources|external links|further reading|bibliography|see also)\s*$/i;
  const cut = lines.findIndex((l) => END.test(l));
  const text = (cut > 0 ? lines.slice(0, cut) : lines)
    .filter((l) => !/^\^|^↑|retrieved \d{1,2} \w+ \d{4}|archived from the original|^\[\d+\]$|^\[edit\]$/i.test(l))
    .map((l) => l.replace(/\[\s*(?:\d+|[a-z]|edit|citation needed)\s*\]/gi, '').replace(/\s+([,.;:!?)])/g, '$1').trim())
    .filter(Boolean)
    .join('\n');
  return { title, text };
}

/** Fetch a public page's raw body (same safety rules). Used by the importer and the site crawler. */
export async function fetchPageRaw(rawUrl: string): Promise<{ url: string; type: string; raw: string; lastModified: string | null }> {
  let url = await assertPublicUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'AI-Bajan-KnowledgeImporter/1.0 (+contact site admin)', Accept: 'text/html,text/plain;q=0.9' },
      });
    } catch {
      clearTimeout(timer);
      throw new AppError(502, 'FETCH_FAILED', 'The website could not be reached or took too long to respond.');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      clearTimeout(timer);
      url = await assertPublicUrl(new URL(res.headers.get('location')!, url).toString());
      continue;
    }
    if (!res.ok) {
      clearTimeout(timer);
      throw new AppError(502, 'FETCH_FAILED', `The website responded with HTTP ${res.status}.`, { httpStatus: res.status });
    }
    const type = res.headers.get('content-type') ?? '';
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
      clearTimeout(timer);
      throw new AppError(415, 'UNSUPPORTED_TYPE', 'Only web pages (HTML or plain text) can be imported. PDFs are not supported yet.');
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) {
          await reader.cancel();
          clearTimeout(timer);
          throw new AppError(413, 'PAGE_TOO_LARGE', 'The page is larger than 3 MB.');
        }
        chunks.push(value);
      }
    }
    clearTimeout(timer);
    return { url: url.toString(), type, raw: Buffer.concat(chunks).toString('utf8'), lastModified: res.headers.get('last-modified') };
  }
  throw new AppError(502, 'TOO_MANY_REDIRECTS', 'The website redirected too many times.');
}

export async function fetchPageText(rawUrl: string): Promise<{ url: string; title: string; text: string; updatedAt: string | null }> {
  const { url, type, raw, lastModified } = await fetchPageRaw(rawUrl);
  const { title, text } = /text\/plain/i.test(type) ? { title: '', text: cleanText(raw) } : htmlToText(raw);
  if (text.length < 200) throw new AppError(422, 'NOT_ENOUGH_TEXT', 'The page does not contain enough readable text to import.');
  return { url, title, text: text.slice(0, 190_000), updatedAt: pageUpdatedDate(raw, lastModified) };
}

const isoDay = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isoDay(`${s}T12:00:00Z`);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // A date without a time ("5 June 2025") parses as local midnight: keep that calendar day.
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = /\d:\d\d/.test(s) ? d.toISOString().slice(0, 10) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // Ignore impossible dates (future, or before the web).
  return day > new Date(Date.now() + 86400_000).toISOString().slice(0, 10) || day < '1995-01-01' ? null : day;
};

/**
 * The date a page says it was last updated (YYYY-MM-DD), or null when it does not say.
 * Checks, in order: modified-time meta tags, JSON-LD dateModified, a visible "Last updated"
 * line, then the HTTP Last-Modified header (often just the time the page was generated).
 */
export function pageUpdatedDate(html: string, lastModifiedHeader?: string | null): string | null {
  const meta = (name: string) =>
    html.match(new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1] ??
    html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${name}["']`, 'i'))?.[1];
  const candidates = [
    meta('article:modified_time'),
    meta('og:updated_time'),
    meta('dateModified'),
    meta('last-modified'),
    html.match(/"dateModified"\s*:\s*"([^"]+)"/i)?.[1],
    html.replace(/<[^>]+>/g, ' ').match(/(?:last\s+(?:updated|modified|reviewed)|updated\s+on)\s*:?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+[0-9]{4}|[A-Za-z]+\s+[0-9]{1,2},?\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i)?.[1]?.replace(/(\d)(st|nd|rd|th)/, '$1'),
    meta('article:published_time'),
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1],
    lastModifiedHeader,
  ];
  for (const c of candidates) {
    const day = isoDay(c);
    if (day) return day;
  }
  return null;
}
