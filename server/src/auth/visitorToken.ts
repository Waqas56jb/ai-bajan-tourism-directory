import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Anonymous visitor sessions for the public chatbot.
 * Token format: v1.<visitorId>.<expiresAtEpochSeconds>.<hmac>
 * The visitor id is random; the database only stores a hash of it (visitor_key), so a leaked
 * database row cannot be turned back into a usable token.
 */
const TTL_SECONDS = 60 * 60 * 24 * 30;

function sign(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueVisitorToken(secret: string, now = Date.now()) {
  const visitorId = randomUUID();
  const exp = Math.floor(now / 1000) + TTL_SECONDS;
  const payload = `v1.${visitorId}.${exp}`;
  return { token: `${payload}.${sign(secret, payload)}`, visitorId, expiresAt: new Date(exp * 1000).toISOString() };
}

export function verifyVisitorToken(secret: string, token: string | undefined, now = Date.now()): string | null {
  if (!token || token.length > 200) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const [, visitorId, expRaw, mac] = parts;
  if (!/^[0-9a-f-]{36}$/.test(visitorId) || !/^\d{9,11}$/.test(expRaw)) return null;
  const expected = Buffer.from(sign(secret, `v1.${visitorId}.${expRaw}`));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (Number(expRaw) * 1000 < now) return null;
  return visitorId;
}

/** Stored ownership key: never the raw visitor id. */
export const visitorKey = (visitorId: string) => createHash('sha256').update(`visitor:${visitorId}`).digest('hex');
