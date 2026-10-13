import { createHash } from 'node:crypto';

/** Remove control characters (except newline/tab), normalise Unicode and collapse spacing. */
export function cleanText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠-⁤﻿]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Single-line variant for user queries. */
export function cleanLine(input: string): string {
  return cleanText(input).replace(/\s+/g, ' ');
}

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

/** Validate an outbound link: http(s) only, no credentials, no javascript:/data: URLs. */
export function isSafeHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password && u.hostname.includes('.');
  } catch {
    return false;
  }
}
