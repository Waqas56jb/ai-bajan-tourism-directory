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

async function assertPublicUrl(raw: string): Promise<URL> {
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
  let body = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html.match(/<body[\s\S]*?<\/body>/i)?.[0] ?? html;
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
    .map((l) => l.replace(/\[\d+\]|\[edit\]|\[citation needed\]/gi, '').trim())
    .filter(Boolean)
    .join('\n');
  return { title, text };
}

export async function fetchPageText(rawUrl: string): Promise<{ url: string; title: string; text: string }> {
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
      throw new AppError(502, 'FETCH_FAILED', `The website responded with HTTP ${res.status}.`);
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
    const raw = Buffer.concat(chunks).toString('utf8');
    const { title, text } = /text\/plain/i.test(type) ? { title: '', text: cleanText(raw) } : htmlToText(raw);
    if (text.length < 200) throw new AppError(422, 'NOT_ENOUGH_TEXT', 'The page does not contain enough readable text to import.');
    return { url: url.toString(), title, text: text.slice(0, 190_000) };
  }
  throw new AppError(502, 'TOO_MANY_REDIRECTS', 'The website redirected too many times.');
}
