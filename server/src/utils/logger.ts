import pino from 'pino';

/**
 * Structured logger. Known secret-bearing paths are redacted, and every string value passes through
 * `scrub()` so a key that ends up inside an error message is still masked.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-visitor-token"]',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.api_key',
  '*.secret',
  '*.authorization',
  '*.accessToken',
  '*.visitorToken',
];

const SECRET_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/g, // OpenAI keys
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}/g, // Supabase API keys
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, // JWTs
  /postgres(?:ql)?:\/\/[^\s'"]+/gi, // connection strings
  /Bearer\s+[A-Za-z0-9._-]+/gi,
];

export function scrub(text: string): string {
  let out = text;
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[redacted]');
  const pw = process.env.DATABASE_PASSWORD;
  if (pw && pw.length >= 6) out = out.split(pw).join('[redacted]');
  return out;
}

function deepScrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (typeof value === 'string') return scrub(value);
  if (Array.isArray(value)) return value.map((v) => deepScrub(v, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if (value instanceof Error) return { name: value.name, message: scrub(value.message), code: (value as { code?: string }).code };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepScrub(v, depth + 1)]));
  }
  return value;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'ai-bajan-api' },
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  formatters: {
    log: (obj) => deepScrub(obj) as Record<string, unknown>,
  },
  serializers: {
    err: (err: Error) => ({
      type: err.name,
      message: scrub(err.message),
      code: (err as { code?: string }).code,
      // Stacks stay in server logs only (never in HTTP responses) and are scrubbed as well.
      stack: err.stack ? scrub(err.stack) : undefined,
    }),
  },
});

export type Logger = typeof logger;
