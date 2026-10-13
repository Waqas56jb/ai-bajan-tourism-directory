import { describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import { hasPermission, permissionsFor, ROLE_PERMISSIONS } from '../../src/auth/permissions.js';
import { issueVisitorToken, verifyVisitorToken, visitorKey } from '../../src/auth/visitorToken.js';
import { ConfigError, parseEnv } from '../../src/config/env.js';
import { checkMigrationSql } from '../../src/database/sqlSafety.js';
import { chunkDocument, chunkFaq, packText } from '../../src/indexing/chunker.js';
import { extractText, ExtractionError, safeFileName } from '../../src/knowledge/fileExtraction.js';
import { classifyOpenAiError } from '../../src/llm/openaiProvider.js';
import { backoffDelay, ProviderError, Semaphore, withRetry } from '../../src/llm/retry.js';
import { validateModelAnswer } from '../../src/rag/answerValidation.js';
import { scrub } from '../../src/utils/logger.js';
import { cleanText, isSafeHttpUrl, slugify } from '../../src/utils/text.js';
import { listMigrations } from '../../src/database/migrate.js';

describe('chunking', () => {
  it('keeps FAQ question and answer together', () => {
    const [c] = chunkFaq('Do I need a visa?', 'Many visitors do not need a visa for short stays.');
    expect(c.text).toBe('Question: Do I need a visa?\nAnswer: Many visitors do not need a visa for short stays.');
  });
  it('splits documents on headings and prefixes each chunk with its heading', () => {
    const chunks = chunkDocument('Guide', '# Beaches\nCarlisle Bay is calm.\n\n# Food\nTry fish cakes.');
    expect(chunks.map((c) => c.text)).toEqual(['Guide › Beaches\nCarlisle Bay is calm.', 'Guide › Food\nTry fish cakes.']);
  });
  it('bounds chunk size and overlaps long text', () => {
    const para = Array.from({ length: 80 }, (_, i) => `Sentence number ${i} about Barbados beaches.`).join(' ');
    const chunks = packText(para, 'Title', { maxChars: 400, overlapChars: 80 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(400);
      expect(c.startsWith('Title\n')).toBe(true);
    }
  });
  it('returns nothing for empty content', () => {
    expect(packText('   \n ', 'x')).toEqual([]);
  });
});

describe('answer validation', () => {
  const sources = [{ id: 'S1', type: 'listing', title: 'Westside Chemist', text: 'Phone: +1 246-555-0142\nWebsite: https://example.com/westside' }];
  it('accepts contact details present in sources and drops unknown source ids', () => {
    const v = validateModelAnswer({ answer: 'Call +1 246-555-0142 or see https://example.com/westside.', source_ids: ['S1', 'S9'], needs_clarification: false, clarification_question: '' }, sources);
    expect(v.ok).toBe(true);
    expect(v.answer?.source_ids).toEqual(['S1']);
    expect(v.problems).toContain('dropped unknown source ids');
  });
  it('rejects a fabricated phone number', () => {
    expect(validateModelAnswer({ answer: 'Call 246-555-9999', source_ids: ['S1'], needs_clarification: false, clarification_question: '' }, sources).ok).toBe(false);
  });
  it('rejects fabricated emails and URLs', () => {
    expect(validateModelAnswer({ answer: 'Email sales@fake.bb', source_ids: [], needs_clarification: false, clarification_question: '' }, sources).ok).toBe(false);
    expect(validateModelAnswer({ answer: 'See https://evil.example.net', source_ids: [], needs_clarification: false, clarification_question: '' }, sources).ok).toBe(false);
  });
  it('rejects malformed or empty output', () => {
    expect(validateModelAnswer(null, sources).ok).toBe(false);
    expect(validateModelAnswer({ answer: '  ', source_ids: [], needs_clarification: false }, sources).ok).toBe(false);
  });
});

describe('retry policy', () => {
  it('retries retryable errors with bounded attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderError('server_error', 'x', true));
    await expect(withRetry(fn, { retries: 2, sleep: async () => {} })).rejects.toThrow('x');
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it('never retries non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new ProviderError('auth', 'bad key', false));
    await expect(withRetry(fn, { retries: 5, sleep: async () => {} })).rejects.toThrow('bad key');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('succeeds after a transient failure', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new ProviderError('rate_limited', 'slow down', true)).mockResolvedValue('ok');
    await expect(withRetry(fn, { retries: 2, sleep: async () => {} })).resolves.toBe('ok');
  });
  it('uses capped exponential backoff with jitter', () => {
    expect(backoffDelay(1, 300, 8000, () => 1)).toBe(300);
    expect(backoffDelay(4, 300, 8000, () => 1)).toBe(2400);
    expect(backoffDelay(10, 300, 8000, () => 1)).toBe(8000);
    expect(backoffDelay(3, 300, 8000, () => 0)).toBe(0);
  });
  it('semaphore caps concurrency', async () => {
    const s = new Semaphore(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        s.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await new Promise((r) => setTimeout(r, 5));
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
  it('classifies OpenAI errors', () => {
    const h = new Headers();
    expect(classifyOpenAiError(new OpenAI.RateLimitError(429, { message: 'x' }, 'x', h)).retryable).toBe(true);
    expect(classifyOpenAiError(new OpenAI.AuthenticationError(401, { message: 'x' }, 'x', h)).kind).toBe('auth');
    expect(classifyOpenAiError(new OpenAI.NotFoundError(404, { message: 'x' }, 'x', h)).kind).toBe('model_not_found');
    expect(classifyOpenAiError(new OpenAI.InternalServerError(503, { message: 'x' }, 'x', h)).retryable).toBe(true);
    expect(classifyOpenAiError(new OpenAI.APIConnectionTimeoutError()).kind).toBe('timeout');
    expect(classifyOpenAiError(new OpenAI.RateLimitError(429, { code: 'insufficient_quota' }, 'quota', h)).retryable).toBe(false);
  });
});

describe('permissions', () => {
  it('maps roles to operations', () => {
    expect(hasPermission('super_admin', 'admins:manage')).toBe(true);
    expect(hasPermission('administrator', 'admins:manage')).toBe(false);
    expect(hasPermission('analyst', 'listings:write')).toBe(false);
    expect(hasPermission('moderator', 'listings:publish')).toBe(true);
    expect(hasPermission('content_manager', 'conversations:read')).toBe(false);
    expect(hasPermission(undefined, 'listings:read')).toBe(false);
  });
  it('every role can at least read analytics', () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>) expect(permissionsFor(role)).toContain('analytics:read');
  });
});

describe('visitor tokens', () => {
  const secret = 'x'.repeat(40);
  it('round-trips and is bound to the secret', () => {
    const t = issueVisitorToken(secret);
    expect(verifyVisitorToken(secret, t.token)).toBe(t.visitorId);
    expect(verifyVisitorToken('y'.repeat(40), t.token)).toBeNull();
  });
  it('rejects tampering and expiry', () => {
    const t = issueVisitorToken(secret);
    const parts = t.token.split('.');
    const forged = [parts[0], '11111111-1111-4111-8111-111111111111', parts[2], parts[3]].join('.');
    expect(verifyVisitorToken(secret, forged)).toBeNull();
    expect(verifyVisitorToken(secret, t.token, Date.now() + 31 * 86400_000)).toBeNull();
    expect(verifyVisitorToken(secret, 'garbage')).toBeNull();
  });
  it('stores only a hash of the visitor id', () => {
    expect(visitorKey('abc')).toMatch(/^[0-9a-f]{64}$/);
    expect(visitorKey('abc')).not.toContain('abc');
  });
});

describe('migration safety scanner', () => {
  it('accepts the shipped migrations', () => {
    for (const m of listMigrations()) expect(checkMigrationSql(m.raw).problems).toEqual([]);
  });
  it.each([
    ['drop table public.users;', 'DROP'],
    ['truncate public.anything;', 'TRUNCATE'],
    ['create table if not exists {{schema}}.users (id int);', 'prefix'],
    ['create index foo on {{schema}}.website_with_rag_x (a);', 'prefix'],
    ['alter system set work_mem = 1;', 'database-wide'],
    ['create extension vector;', 'extensions'],
    ['grant all on {{schema}}.website_with_rag_x to anon;', 'GRANT'],
    ['delete from public.chat_messages;', 'DELETE'],
    ['create or replace function {{schema}}.website_with_rag_f() returns void language plpgsql as $$ begin drop table x; end $$;', 'function body'],
  ])('rejects %s', (sql, hint) => {
    const r = checkMigrationSql(sql);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain(hint);
  });
});

describe('configuration', () => {
  it('names missing variables without printing values', () => {
    try {
      parseEnv({ SUPABASE_URL: 'https://x.supabase.co', DATABASE_PASSWORD: 'supersecretvalue' } as NodeJS.ProcessEnv);
      throw new Error('should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      const msg = (e as Error).message;
      expect(msg).toContain('DATABASE_HOST is not set');
      expect(msg).toContain('SESSION_SECRET is not set');
      expect(msg).not.toContain('supersecretvalue');
    }
  });
});

describe('secret redaction and text utilities', () => {
  it('scrubs keys, JWTs and connection strings', () => {
    const s = scrub('key sk-abcdefghijklmnopqrstuv token eyJhbGciOiJI.eyJzdWIiOiIx.c2lnbmF0dXJl postgres://u:p@h/db sb_secret_abcdefghijkl');
    expect(s).not.toMatch(/sk-abc|eyJhbG|postgres:\/\/|sb_secret_abc/);
  });
  it('validates outbound URLs', () => {
    expect(isSafeHttpUrl('https://example.com/a')).toBe(true);
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpUrl('https://user:pw@example.com')).toBe(false);
    expect(isSafeHttpUrl('data:text/html,hi')).toBe(false);
  });
  it('slugifies and cleans text', () => {
    expect(slugify('Café & Rum Shop!')).toBe('cafe-and-rum-shop');
    expect(cleanText('a\u0000b‮c  \n\n\n\nd')).toBe('abc\n\nd');
  });
});

describe('file extraction', () => {
  it('accepts UTF-8 text and converts CSV rows to facts', () => {
    expect(extractText('notes.txt', Buffer.from('Hello Barbados')).text).toBe('Hello Barbados');
    const csv = extractText('list.csv', Buffer.from('Name,Area\n"Fish Fry, Oistins",Christ Church\n'));
    expect(csv.text).toBe('Name: Fish Fry, Oistins; Area: Christ Church');
  });
  it('rejects unsupported types, binary content and empty files', () => {
    expect(() => extractText('a.pdf', Buffer.from('%PDF'))).toThrow(ExtractionError);
    expect(() => extractText('a.txt', Buffer.from([0x48, 0x00, 0x49]))).toThrow(/text file/);
    expect(() => extractText('a.txt', Buffer.from([0xff, 0xfe, 0xfd]))).toThrow(/UTF-8/);
    expect(() => extractText('a.md', Buffer.from('   '))).toThrow(/no text/);
  });
  it('sanitises file names', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('my<file>.txt')).toBe('my_file_.txt');
  });
});
