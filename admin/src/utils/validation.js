/** Shared validation helpers. Client-side only — the backend must validate everything again. */

export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidEmail(value) {
  return /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(String(value ?? '').trim());
}

export function isValidUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** A safe http(s) URL for rendering a link, or null. Never returns javascript:/data: URLs. */
export function safeExternalUrl(value) {
  return isValidUrl(value) ? new URL(String(value).trim()).toString() : null;
}

export function isValidPhone(value) {
  const digits = String(value ?? '').replace(/[^\d+]/g, '');
  return digits.length >= 7 && digits.length <= 16;
}

export function isValidLatitude(v) {
  const n = Number(v);
  return v !== '' && v !== null && v !== undefined && Number.isFinite(n) && n >= -90 && n <= 90;
}

export function isValidLongitude(v) {
  const n = Number(v);
  return v !== '' && v !== null && v !== undefined && Number.isFinite(n) && n >= -180 && n <= 180;
}
