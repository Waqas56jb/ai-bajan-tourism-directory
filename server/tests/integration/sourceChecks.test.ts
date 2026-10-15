import request from 'supertest';
import type { Express } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppContext } from '../../src/app/context.js';
import type { JsonCompletionRequest } from '../../src/llm/provider.js';
import { checkDueSources, contentHash, type PageFetcher } from '../../src/knowledge/sourceChecker.js';
import { afterSourceWrite } from '../../src/sync/syncQueue.js';
import { AppError } from '../../src/utils/errors.js';
import { createTestContext, drainQueue, ensureTestSchema, fakeLlm, resetTestSchema, seedAdmins, seedDirectory } from './helpers.js';

let ctx: AppContext;
let app: Express;
const prompts: JsonCompletionRequest[] = [];
const llm = fakeLlm((req) => {
  prompts.push(req);
  const ids = [...req.messages[1].content.matchAll(/<source id="(S\d+)"/g)].map((m) => m[1]);
  return { answer: 'Answer from the sources.', source_ids: ids.slice(0, 3), needs_clarification: false, clarification_question: '' };
});

const BODY = 'Bajan fish cakes are fried balls of salted cod mixed with flour, herbs, pepper and seasoning. '.repeat(5);
const WIKI = 'Fish cakes are a dish found in many countries, made from fish and potato or flour, then fried. '.repeat(5);

async function addPage(url: string, title: string, text: string) {
  return ctx.db.tx(async (client) => {
    const r = await client.query<{ id: string }>(
      `insert into ${ctx.db.t('knowledge_documents')} (title, content, source_type, source_reference, status, approval_status, content_hash, source_updated_at)
       values ($1, $2, 'article', $3, 'published', 'approved', $4, '2024-01-10') returning id`,
      [title, text, url, contentHash(title, text)],
    );
    await afterSourceWrite(client, ctx.db, { sourceType: 'document', sourceId: r.rows[0].id, version: 1, eligible: true });
    return r.rows[0].id;
  });
}

beforeAll(async () => {
  await ensureTestSchema();
  ({ ctx, app } = createTestContext(llm));
  await resetTestSchema(ctx.db);
  await seedAdmins(ctx.db);
  await seedDirectory(ctx.db);
  await drainQueue(ctx);
});
afterAll(async () => ctx.db.close());

describe('Trusted Information Network', () => {
  let vbId = '';
  let goneId = '';

  it('cites the institutional page before Wikipedia, with its authority and update date', async () => {
    vbId = await addPage('https://www.visitbarbados.org/barbados-street-food', 'Barbados Street Food', BODY);
    await addPage('https://en.wikipedia.org/wiki/Fish_cake', 'Fishcake', WIKI);
    goneId = await addPage('https://www.gov.bb/old-page', 'Old notice about fish cake vending', 'Fish cake vendors notice. '.repeat(20));
    await drainQueue(ctx);
    prompts.length = 0;
    const res = await request(app).post('/api/v1/chat').send({ message: 'What are Bajan fish cakes made of?' }).expect(200);
    const prompt = prompts.at(-1)!.messages[1].content;
    const vbAt = prompt.indexOf('title="Barbados Street Food"');
    const wikiAt = prompt.indexOf('title="Fishcake"');
    expect(vbAt).toBeGreaterThan(-1);
    expect(wikiAt === -1 || vbAt < wikiAt).toBe(true);
    expect(prompt).toMatch(/title="Barbados Street Food" authority="Barbadian institution" updated="2024-01-10"/);
    if (wikiAt > -1) expect(prompt).toMatch(/title="Fishcake" authority="general background reference"/);
    const vb = res.body.sources.find((s: { title: string }) => s.title === 'Barbados Street Food');
    expect(vb).toMatchObject({ tier: 'institutional', updatedAt: '2024-01-10', url: 'https://www.visitbarbados.org/barbados-street-food' });
  });

  it('updates changed pages, keeps unchanged ones and archives pages that are gone', async () => {
    const pages: Record<string, string> = {
      'https://www.visitbarbados.org/barbados-street-food': `${BODY}\nNew: fish cakes are sold at the Oistins Friday fish fry.`,
      'https://en.wikipedia.org/wiki/Fish_cake': WIKI,
    };
    const fetcher: PageFetcher = async (url) => {
      if (!(url in pages)) throw new AppError(502, 'FETCH_FAILED', 'HTTP 404', { httpStatus: 404 });
      const title = url.includes('wikipedia') ? 'Fishcake' : 'Barbados Street Food';
      return { url, title, text: pages[url], html: `<meta property="article:modified_time" content="2026-09-30T10:00:00Z">${pages[url]}` };
    };
    const first = await checkDueSources(ctx.db, { limit: 10, budgetMs: 10_000, fetcher, renderedFetcher: fetcher });
    expect(first).toMatchObject({ updated: 1, unchanged: 1, error: 1, archived: 0 });
    const vb = await ctx.db.one<{ content: string; source_updated_at: Date; content_version: number }>(
      `select content, source_updated_at, content_version from ${ctx.db.t('knowledge_documents')} where id = $1`,
      [vbId],
    );
    expect(vb!.content).toContain('Oistins Friday fish fry');
    expect(vb!.content_version).toBe(2);
    const pending = await ctx.db.one<{ n: number }>(`select count(*)::int n from ${ctx.db.t('sync_jobs')} where source_id = $1 and status = 'pending'`, [vbId]);
    expect(pending!.n).toBe(1);

    // A second check that still finds the page missing archives it and removes it from the assistant.
    const second = await checkDueSources(ctx.db, { limit: 10, budgetMs: 10_000, fetcher, renderedFetcher: fetcher });
    expect(second.archived).toBe(1);
    await drainQueue(ctx);
    const gone = await ctx.db.one<{ status: string; active: number }>(
      `select d.status, (select count(*)::int from ${ctx.db.t('knowledge_chunks')} c where c.source_id = d.id and c.is_active) active
         from ${ctx.db.t('knowledge_documents')} d where d.id = $1`,
      [goneId],
    );
    expect(gone).toMatchObject({ status: 'archived', active: 0 });
  });
});
