import type { AppContext } from '../app/context.js';
import { logger } from '../utils/logger.js';
import { singular } from './lexicon.js';
import type { QueryAnalysis } from './queryAnalysis.js';
import { buildTsQuery } from './queryBuilder.js';

export interface ChunkHit {
  chunk_id: string;
  source_type: 'listing' | 'faq' | 'document';
  source_id: string;
  source_version: number;
  chunk_kind: string;
  title: string;
  chunk_text: string;
  metadata: Record<string, unknown>;
  category_ids: string[];
  location_ids: string[];
  rank?: number;
  similarity?: number;
}

export interface Candidate {
  key: string;
  sourceType: ChunkHit['source_type'];
  sourceId: string;
  title: string;
  metadata: Record<string, unknown>;
  chunks: ChunkHit[];
  /** Fused score (reciprocal rank fusion + boosts). */
  score: number;
  signals: {
    structured: boolean;
    keywordRank: number | null;
    vectorSimilarity: number | null;
    categoryMatch: boolean;
    locationMatch: boolean;
  };
  /** Fraction of key terms found in this candidate's text (synonym/stem aware). */
  coverage: number;
  /** Whether every product/refinement term appears in this candidate's text. */
  productMatch: boolean;
}

export interface RetrievalResult {
  candidates: Candidate[];
  methods: string[];
  errors: Array<{ method: string; kind: string }>;
  /** True when every attempted retrieval method failed (technical failure, not "no knowledge"). */
  failed: boolean;
  timings: Record<string, number>;
  tsquery: string | null;
  refinementUsed: boolean;
}

export const RETRIEVAL_CONFIG_VERSION = 'hybrid-rrf-v1';
const RRF_K = 60;

const lower = (s: string) => s.toLowerCase();

/** Term present in text, allowing plural/singular forms (word-boundary match). */
export function textHasTerm(text: string, term: string): boolean {
  const t = lower(text);
  const variants = new Set([term, singular(term), `${singular(term)}s`, `${singular(term)}es`, singular(term).replace(/y$/, 'ies')]);
  return [...variants].some((v) => v.length > 1 && new RegExp(`(?:^|[^a-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+')}(?:$|[^a-z0-9])`).test(t));
}

async function timed<T>(timings: Record<string, number>, name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    timings[name] = Math.round(performance.now() - start);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(Object.assign(new Error(`${label} timed out`), { code: 'RETRIEVAL_TIMEOUT' })), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function embedQuery(ctx: AppContext, text: string): Promise<number[]> {
  const key = `${ctx.llm.embeddingModel}:${text}`;
  const cached = ctx.embeddingCache.get(key);
  if (cached) return cached;
  const [vector] = await ctx.llm.embed([text]);
  if (ctx.embeddingCache.size > 500) ctx.embeddingCache.delete(ctx.embeddingCache.keys().next().value!);
  ctx.embeddingCache.set(key, vector);
  return vector;
}

/** Metadata retrieval: active listing chunks in the detected categories (and location). */
async function structuredSearch(ctx: AppContext, a: QueryAnalysis, limit: number): Promise<ChunkHit[]> {
  const { db } = ctx;
  const categoryIds = a.categories.map((c) => c.id);
  const locationIds = a.locations.map((l) => l.id);
  const listingIds = a.listings.map((l) => l.id).filter(Boolean);
  if (!categoryIds.length && !listingIds.length) return [];
  const where = [`c.is_active`, `c.source_type = 'listing'`];
  const p: unknown[] = [];
  if (listingIds.length) {
    p.push(listingIds);
    where.push(`c.source_id = any($${p.length})`);
  } else {
    p.push(categoryIds);
    where.push(`c.category_ids && $${p.length}`);
    if (locationIds.length) {
      p.push(locationIds);
      where.push(`c.location_ids && $${p.length}`);
    }
  }
  p.push(limit * 3);
  return db.many<ChunkHit>(
    `select c.id as chunk_id, c.source_type, c.source_id, c.source_version, c.chunk_kind, c.title, c.chunk_text, c.metadata,
            c.category_ids, c.location_ids
       from ${db.t('knowledge_chunks')} c
       left join ${db.t('listings')} l on l.id = c.source_id
      where ${where.join(' and ')}
      order by l.featured desc nulls last, c.title, c.chunk_index
      limit $${p.length}`,
    p,
  );
}

async function keywordSearch(ctx: AppContext, tsquery: string, limit: number): Promise<ChunkHit[]> {
  return ctx.db.many<ChunkHit>(`select * from ${ctx.db.fn('keyword_search')}($1, null, null, null, $2)`, [tsquery, limit]);
}

async function vectorSearch(ctx: AppContext, vector: number[], limit: number): Promise<ChunkHit[]> {
  return ctx.db.many<ChunkHit>(`select * from ${ctx.db.fn('vector_search')}($1::extensions.vector, null, null, null, $2)`, [
    `[${vector.join(',')}]`,
    limit,
  ]);
}

/** Text used to build the semantic query: the user's words plus resolved category/location names. */
export function semanticQueryText(a: QueryAnalysis): string {
  const extras = [...a.categories.map((c) => c.name), ...a.locations.map((l) => l.name), ...a.listings.map((l) => l.name)];
  return [a.original, ...extras.filter((e) => !a.normalized.includes(e.toLowerCase()))].join(' ').slice(0, 2000);
}

export async function retrieve(ctx: AppContext, a: QueryAnalysis): Promise<RetrievalResult> {
  const cfg = ctx.config;
  const limit = cfg.RETRIEVAL_CANDIDATE_LIMIT;
  const timeout = cfg.RETRIEVAL_TIMEOUT_MS;
  const timings: Record<string, number> = {};
  const methods: string[] = [];
  const errors: RetrievalResult['errors'] = [];
  const attempted: string[] = [];

  // Keyword terms: the meaning-bearing words, the matched category terms (so "pharmacies" finds
  // documents that say "chemist"), and product/refinement phrases.
  const categoryTerms = a.categories.map((c) => c.matched).filter((m) => m !== '(memory)');
  const termList = [...a.keyTerms, ...categoryTerms, ...a.listings.map((l) => l.name)];
  const tsquery = buildTsQuery(termList, [...a.phrases, ...a.productTerms.filter((p) => p.includes(' '))]);

  const tasks: Array<Promise<[string, ChunkHit[]]>> = [];
  const run = (name: string, fn: () => Promise<ChunkHit[]>) => {
    attempted.push(name);
    tasks.push(
      timed(timings, name, () => withTimeout(fn(), timeout, name))
        .then((rows): [string, ChunkHit[]] => {
          methods.push(name);
          return [name, rows];
        })
        .catch((err): [string, ChunkHit[]] => {
          errors.push({ method: name, kind: (err as { code?: string; kind?: string }).kind ?? (err as { code?: string }).code ?? 'error' });
          logger.warn({ err, method: name }, 'retrieval method failed');
          return [name, []];
        }),
    );
  };

  if (a.categories.length || a.listings.length) run('structured', () => structuredSearch(ctx, a, limit));
  if (tsquery) run('keyword', () => keywordSearch(ctx, tsquery, limit));
  if (ctx.llm.available) {
    run('vector', async () => {
      const vector = await timed(timings, 'embedding', () => embedQuery(ctx, semanticQueryText(a)));
      return vectorSearch(ctx, vector, limit);
    });
  }

  const lists = new Map(await Promise.all(tasks));
  let refinementUsed = false;

  // Stage F: one bounded refinement pass when keyword search found nothing — retry with singular
  // forms and the individual words of phrases (never more than one extra query).
  if (tsquery && lists.get('keyword')?.length === 0 && !errors.some((e) => e.method === 'keyword')) {
    const relaxed = buildTsQuery([...new Set([...termList.map(singular), ...a.productTerms.flatMap((p) => p.split(' '))])]);
    if (relaxed && relaxed !== tsquery) {
      refinementUsed = true;
      try {
        lists.set('keyword', await timed(timings, 'keyword_refined', () => withTimeout(keywordSearch(ctx, relaxed, limit), timeout, 'keyword_refined')));
        methods.push('keyword_refined');
      } catch (err) {
        errors.push({ method: 'keyword_refined', kind: (err as { code?: string }).code ?? 'error' });
      }
    }
  }

  const failed = attempted.length > 0 && errors.filter((e) => attempted.includes(e.method)).length === attempted.length;
  const candidates = fuse(a, lists, cfg.RETRIEVAL_KEYWORD_WEIGHT, cfg.RETRIEVAL_SEMANTIC_WEIGHT, cfg.RETRIEVAL_MIN_SIMILARITY);
  return { candidates, methods, errors, failed, timings, tsquery, refinementUsed };
}

/**
 * Reciprocal rank fusion at source level: each list contributes w / (k + rank) for the best rank
 * of any chunk of a source. Structured (category/location) matches get their own list so that a
 * short directory query is answered from the directory even when wording differs.
 * Vector hits below the minimum similarity are ignored (noise floor).
 */
export function fuse(
  a: QueryAnalysis,
  lists: Map<string, ChunkHit[]>,
  keywordWeight: number,
  semanticWeight: number,
  minSimilarity: number,
): Candidate[] {
  const bySource = new Map<string, Candidate>();
  const weights: Record<string, number> = { structured: 1.2, keyword: keywordWeight, vector: semanticWeight };
  const categoryIds = new Set(a.categories.map((c) => c.id));
  const locationIds = new Set(a.locations.map((l) => l.id));

  for (const [method, rows] of lists) {
    const seenInList = new Set<string>();
    let rank = 0;
    for (const hit of rows) {
      if (method === 'vector' && (hit.similarity ?? 0) < minSimilarity) continue;
      const key = `${hit.source_type}:${hit.source_id}`;
      let cand = bySource.get(key);
      if (!cand) {
        cand = {
          key,
          sourceType: hit.source_type,
          sourceId: hit.source_id,
          title: hit.title,
          metadata: hit.metadata ?? {},
          chunks: [],
          score: 0,
          signals: { structured: false, keywordRank: null, vectorSimilarity: null, categoryMatch: false, locationMatch: false },
          coverage: 0,
          productMatch: false,
        };
        bySource.set(key, cand);
      }
      if (!cand.chunks.some((c) => c.chunk_id === hit.chunk_id)) cand.chunks.push(hit);
      if (method === 'structured') cand.signals.structured = true;
      if (method === 'keyword') cand.signals.keywordRank = Math.max(cand.signals.keywordRank ?? 0, hit.rank ?? 0);
      if (method === 'vector') cand.signals.vectorSimilarity = Math.max(cand.signals.vectorSimilarity ?? 0, hit.similarity ?? 0);
      if (!seenInList.has(key)) {
        seenInList.add(key);
        rank++;
        cand.score += (weights[method] ?? 1) / (RRF_K + rank);
      }
    }
  }

  const terms = [...new Set([...a.keyTerms.filter((t) => t.length > 2), ...a.categories.map((c) => c.matched).filter((m) => m !== '(memory)')])];
  const product = a.productTerms;
  for (const cand of bySource.values()) {
    const text = `${cand.title}\n${cand.chunks.map((c) => c.chunk_text).join('\n')}`;
    const allCats = cand.chunks.flatMap((c) => c.category_ids);
    const allLocs = cand.chunks.flatMap((c) => c.location_ids);
    cand.signals.categoryMatch = allCats.some((id) => categoryIds.has(id));
    cand.signals.locationMatch = allLocs.some((id) => locationIds.has(id));
    // Coverage counts a matched category as covered by the candidate's category metadata too.
    const covered = terms.filter((t) => textHasTerm(text, t) || (cand.signals.categoryMatch && a.categories.some((c) => c.matched === t)));
    cand.coverage = terms.length ? covered.length / terms.length : 0;
    cand.productMatch = product.length > 0 && product.every((p) => textHasTerm(text, p));
    // Boosts are modest so that relevance from retrieval still dominates.
    if (cand.signals.categoryMatch) cand.score *= 1.25;
    if (locationIds.size && cand.signals.locationMatch) cand.score *= 1.2;
    if (locationIds.size && !cand.signals.locationMatch && cand.sourceType === 'listing') cand.score *= 0.7;
    if (cand.productMatch) cand.score *= 1.3;
    cand.score *= 0.6 + 0.4 * cand.coverage;
    // Keep the most relevant chunks first and drop near-duplicates within a source.
    const seen = new Set<string>();
    cand.chunks = cand.chunks
      .sort((x, y) => (y.similarity ?? y.rank ?? 0) - (x.similarity ?? x.rank ?? 0) || x.chunk_kind.localeCompare(y.chunk_kind))
      .filter((c) => {
        const sig = c.chunk_text.slice(0, 200);
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
      });
  }

  // Cross-source near-duplicate removal (identical text published twice, e.g. FAQ copied into a doc).
  const sorted = [...bySource.values()].sort((x, y) => y.score - x.score || x.key.localeCompare(y.key));
  const fingerprints = new Set<string>();
  return sorted.filter((c) => {
    const fp = c.chunks[0]?.chunk_text.replace(/\s+/g, ' ').slice(-300) ?? c.key;
    if (fingerprints.has(fp)) return false;
    fingerprints.add(fp);
    return true;
  });
}
