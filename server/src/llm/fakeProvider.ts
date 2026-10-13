import { createHash } from 'node:crypto';
import type { JsonCompletionRequest, LlmProvider } from './provider.js';
import { ProviderError } from './retry.js';

/**
 * Deterministic provider for automated tests and offline evaluation. It is NOT used in
 * production: createProvider() only selects it when explicitly asked (tests / eval scripts).
 *
 * Embeddings are hashed bag-of-stems vectors, so texts that share words are close in cosine space.
 * That exercises the real pgvector SQL path without any network call. Completions are produced by
 * a caller-supplied responder (the default echoes the first context block).
 */
const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'is', 'are', 'on', 'at', 'with', 'i', 'do', 'how', 'what', 'which', 'where', 'can', 'me', 'my', 'it', 'be', 'this']);

function stem(w: string) {
  return w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
}

export function fakeEmbedding(text: string, dims: number): number[] {
  const v = new Array<number>(dims).fill(0);
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const raw of words) {
    if (STOP.has(raw)) continue;
    const w = stem(raw);
    const h = createHash('md5').update(w).digest();
    const idx = h.readUInt32BE(0) % dims;
    v[idx] += h[4] & 1 ? 1 : -1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

export type FakeResponder = (req: JsonCompletionRequest) => unknown;

export class FakeProvider implements LlmProvider {
  readonly name = 'fake';
  readonly chatModel = 'fake-chat';
  readonly embeddingModel = 'fake-embedding';
  readonly available = true;
  calls = { embed: 0, complete: 0 };
  failEmbeddings: ProviderError | null = null;
  failCompletions: ProviderError | null = null;

  constructor(
    readonly dimensions: number,
    public responder: FakeResponder | null = null,
  ) {}

  async embed(texts: string[]) {
    this.calls.embed++;
    if (this.failEmbeddings) throw this.failEmbeddings;
    return texts.map((t) => fakeEmbedding(t, this.dimensions));
  }

  async completeJson(req: JsonCompletionRequest) {
    this.calls.complete++;
    if (this.failCompletions) throw this.failCompletions;
    if (!this.responder) throw new ProviderError('not_configured', 'No fake responder configured', false);
    return this.responder(req);
  }
}

/** Provider with no key: every call fails as not_configured (mirrors production without a key). */
export class UnavailableProvider implements LlmProvider {
  readonly name = 'none';
  readonly available = false;
  constructor(
    readonly chatModel: string,
    readonly embeddingModel: string,
    readonly dimensions: number,
  ) {}
  async embed(): Promise<number[][]> {
    throw new ProviderError('not_configured', 'OPENAI_API_KEY is not configured', false);
  }
  async completeJson(): Promise<unknown> {
    throw new ProviderError('not_configured', 'OPENAI_API_KEY is not configured', false);
  }
}
