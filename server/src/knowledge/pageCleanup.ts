/**
 * Clean-up for imported web pages, applied when pages are imported and by `knowledge:repair` for
 * pages already stored:
 *  - repair mis-decoded characters ("countryâ€™s" → "country’s");
 *  - replace a site-wide title ("GOV.BB", "Business Barbados", an icon's "Facebook-color") with the
 *    page's own heading, so the assistant and its citations can tell pages apart;
 *  - recognise news items and announcements and find their publication date, so an old news item is
 *    never presented as current.
 */

/** Windows-1252 bytes that UTF-8 text was mis-decoded through (the usual source of "â€™"). */
const CP1252: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};
const MOJIBAKE = /(?:[ÂÃÄÅâ][\u0080-¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]{1,2})+/g;

/** Re-decodes runs of UTF-8 text that were read as Windows-1252. Leaves correct text untouched. */
export function repairMojibake(text: string): string {
  if (!/[ÂÃâ][\u0080-¿€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/.test(text)) return text;
  return text.replace(MOJIBAKE, (run) => {
    const bytes: number[] = [];
    for (const ch of run) {
      const code = ch.codePointAt(0)!;
      if (code < 0x100) bytes.push(code);
      else if (CP1252[ch] !== undefined) bytes.push(CP1252[ch]);
      else return run;
    }
    const decoded = Buffer.from(bytes).toString('utf8');
    return decoded.includes('�') ? run : decoded;
  });
}

/** Headings that name a section of a site rather than the page itself. */
const GENERIC_HEADING =
  /^(home|menu|search|news|news article|news & information|announcements?|overview|services|our services|about|about us|contact|contact us|main menu|navigation|skip to content|gov\.?bb|welcome|related (links|pages)|share|follow us|quick links|categories|recent posts|most recent|health education|return to.*)$/i;
const ICON_TITLE = /^(facebook|twitter|instagram|youtube|linkedin|whatsapp|tiktok|x|pinterest)(-color)?$/i;

const clean = (s: string) => s.replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim();

/**
 * The page's own title. Keeps a specific title; replaces one shared across a site (or an icon's
 * title) with the first meaningful heading of the page, or its first substantial line.
 */
const STOP = new Set(['the', 'and', 'for', 'of', 'to', 'in', 'a', 'an', 'on', 'php', 'aspx', 'html', 'htm', 'index', 'details', 'servicedetails', 'news', 'article', 'page', 'view', 'item', 'post', 'default', 'content', 'detail']);
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

/** Meaningful words of a page address's last path segment ("/registration-charity-board" → registration, charity, board). */
function slugWords(url?: string): string[] {
  if (!url) return [];
  try {
    const seg = decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean).pop() ?? '';
    return /^[A-Za-z0-9+/=%]{16,}$/.test(seg) && !/[-_]/.test(seg) ? [] : words(seg.replace(/\.[a-z]+$/i, ''));
  } catch {
    return [];
  }
}

export function betterTitle(title: string, text: string, opts: { siteTitles?: Set<string>; url?: string } = {}): string {
  const t = clean(title);
  const generic = !t || ICON_TITLE.test(t) || GENERIC_HEADING.test(t) || opts.siteTitles?.has(t.toLowerCase()) || /^[A-Z.\s]{2,12}$/.test(t);
  if (!generic) return t;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const isDate = (c: string) => newsDate(c) !== null && c.length < 40 || /^(mon|tues|wednes|thurs|fri|satur|sun)day\b/i.test(c);
  const isGood = (l: string) => {
    const c = clean(l);
    return c.length >= 8 && c.length <= 140 && !GENERIC_HEADING.test(c) && !ICON_TITLE.test(c) && !/^[-|/]/.test(l) && c.toLowerCase() !== t.toLowerCase() && /[a-z]/.test(c) && !isDate(c) && !opts.siteTitles?.has(c.toLowerCase());
  };
  // A heading that shares words with the page address is the page's own heading, not a menu's.
  const slug = slugWords(opts.url);
  if (slug.length) {
    const scored = lines
      .slice(0, 80)
      .filter((l) => isGood(l) && !/^[-•]/.test(l))
      .map((l) => ({ l, score: words(l).filter((w) => slug.some((s) => s.startsWith(w.slice(0, 5)) || w.startsWith(s.slice(0, 5)))).length / slug.length }))
      .filter((x) => x.score >= 0.5)
      .sort((a, b) => b.score - a.score || Number(/^#/.test(b.l)) - Number(/^#/.test(a.l)) || a.l.length - b.l.length);
    if (scored[0]) return clean(scored[0].l).slice(0, 200);
    // No heading matches: the address itself names the page.
    if (slug.length >= 2) return slug.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  const heading = lines.slice(0, 40).find((l) => /^#{1,3}\s/.test(l) && isGood(l));
  if (heading) return clean(heading).slice(0, 200);
  // News pages often give the headline as a plain line just before the byline ("By GOV.BB").
  const byline = lines.findIndex((l) => /^by\s+\S/i.test(l));
  if (byline > 0 && isGood(lines[byline - 1])) return clean(lines[byline - 1]).slice(0, 200);
  const line = lines.slice(0, 25).find((l) => isGood(l) && !/^[-•]/.test(l) && l.split(' ').length >= 3);
  return line ? clean(line).slice(0, 200) : t || title;
}

const NEWS_URL = /(\/news(\/|_|-|$)|news_article|newsevents|\/announcements?\/|\/press(-releases?)?\/|media-release|\/blog\/|\/\d{4}\/\d{2}\/)/i;

/** True for news items, announcements and press releases. */
export function isNewsPage(url: string | null | undefined, title = '', text = ''): boolean {
  if (url && NEWS_URL.test(url)) return true;
  return /^(press release|media release|news release)\b/i.test(title) || /\n(by\s+[^\n]{2,40}\n)?(posted|published)\s+on\s+/i.test(text.slice(0, 600));
}

const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const DATE_PATTERNS = [
  new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH},?\\s+(\\d{4})\\b`, 'i'),
  new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'i'),
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** The first date in the opening of a news page (its publication date), as YYYY-MM-DD. */
export function newsDate(text: string): string | null {
  const head = text.slice(0, 700);
  const found: Array<{ at: number; day: string }> = [];
  const push = (at: number, y: number, m: number, d: number) => {
    if (y < 1995 || m < 1 || m > 12 || d < 1 || d > 31) return;
    const day = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (day <= new Date(Date.now() + 86400_000).toISOString().slice(0, 10)) found.push({ at, day });
  };
  let m = head.match(DATE_PATTERNS[0]);
  if (m) push(m.index!, Number(m[3]), MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, Number(m[1]));
  m = head.match(DATE_PATTERNS[1]);
  if (m) push(m.index!, Number(m[3]), MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, Number(m[2]));
  m = head.match(DATE_PATTERNS[2]);
  if (m) push(m.index!, Number(m[1]), Number(m[2]), Number(m[3]));
  return found.sort((a, b) => a.at - b.at)[0]?.day ?? null;
}
