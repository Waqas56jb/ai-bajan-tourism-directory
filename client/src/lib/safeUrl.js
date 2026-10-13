/**
 * URL helpers for rendering links from data we do not fully control (listings, chat output).
 * Only http(s), mailto: and tel: are allowed for external links; anything else
 * (javascript:, data:, vbscript: …) is rejected.
 */

export function safeExternalUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function safeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  return /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+$/.test(email) ? email : null;
}

export function safePhone(value) {
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[^\d+]/g, '');
  return digits.length >= 7 && digits.length <= 16 ? digits : null;
}

/** Internal app path ("/businesses?x=y"), never protocol-relative ("//evil.com"). */
export function isInternalPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

/** Classify a link target for safe rendering. Returns null when the link must not be rendered. */
export function classifyHref(href) {
  if (isInternalPath(href)) return { kind: 'internal', href };
  if (typeof href === 'string' && href.startsWith('mailto:')) {
    const email = safeEmail(href.slice(7));
    return email ? { kind: 'external', href: `mailto:${email}` } : null;
  }
  if (typeof href === 'string' && href.startsWith('tel:')) {
    const phone = safePhone(href.slice(4));
    return phone ? { kind: 'external', href: `tel:${phone}` } : null;
  }
  const url = safeExternalUrl(href);
  return url ? { kind: 'external', href: url } : null;
}

export function displayHost(url) {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}
