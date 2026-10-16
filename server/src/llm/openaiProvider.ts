import OpenAI from 'openai';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { JsonCompletionRequest, LlmProvider } from './provider.js';
import { ProviderError, Semaphore, withRetry } from './retry.js';

/** Map SDK errors to classified ProviderErrors. Messages never include request bodies or keys. */
export function classifyOpenAiError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof OpenAI.APIConnectionTimeoutError) return new ProviderError('timeout', 'Model request timed out', true);
  if (err instanceof OpenAI.APIConnectionError) return new ProviderError('network', 'Could not reach the model provider', true);
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    const code = (err as { code?: string }).code ?? '';
    if (status === 401 || status === 403) return new ProviderError('auth', 'Model provider rejected the API key', false);
    if (status === 404) return new ProviderError('model_not_found', 'Configured model was not found', false);
    if (status === 429) {
      if (code === 'insufficient_quota') return new ProviderError('rate_limited', 'Model provider quota exhausted', false);
      const ra = Number(err.headers?.get?.('retry-after'));
      return new ProviderError('rate_limited', 'Model provider rate limit', true, Number.isFinite(ra) ? ra * 1000 : undefined);
    }
    if (status === 400 && /context_length|maximum context/i.test(`${code} ${err.message}`)) {
      return new ProviderError('context_length', 'Prompt exceeded the model context window', false);
    }
    if (status === 400) return new ProviderError('bad_request', 'Model provider rejected the request', false);
    if (status >= 500) return new ProviderError('server_error', `Model provider error (${status})`, true);
  }
  if ((err as Error)?.name === 'AbortError') return new ProviderError('timeout', 'Model request was cancelled', false);
  return new ProviderError('unknown', 'Unexpected model provider failure', false);
}

export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  readonly chatModel: string;
  readonly embeddingModel: string;
  readonly dimensions: number;
  readonly available: boolean;
  private readonly client: OpenAI | null;
  private readonly limiter: Semaphore;
  private readonly retries: number;
  private readonly maxOutputTokens: number;

  constructor() {
    const e = env();
    this.chatModel = e.OPENAI_CHAT_MODEL;
    this.embeddingModel = e.OPENAI_EMBEDDING_MODEL;
    this.dimensions = e.EMBEDDING_DIMENSIONS;
    this.available = e.OPENAI_API_KEY.length > 0;
    this.retries = e.OPENAI_MAX_RETRIES;
    this.maxOutputTokens = e.OPENAI_MAX_OUTPUT_TOKENS;
    this.limiter = new Semaphore(e.LLM_MAX_CONCURRENCY);
    // SDK retries are disabled: withRetry() owns the policy so it is bounded and observable.
    this.client = this.available
      ? new OpenAI({ apiKey: e.OPENAI_API_KEY, timeout: e.OPENAI_TIMEOUT_MS, maxRetries: 0 })
      : null;
  }

  private requireClient(): OpenAI {
    if (!this.client) throw new ProviderError('not_configured', 'OPENAI_API_KEY is not configured', false);
    return this.client;
  }

  async embed(texts: string[], signal?: AbortSignal): Promise<number[][]> {
    const client = this.requireClient();
    if (texts.length === 0) return [];
    const out: number[][] = [];
    // Batch to stay well under request size limits.
    for (let i = 0; i < texts.length; i += 64) {
      const batch = texts.slice(i, i + 64).map((t) => t.slice(0, 24000));
      const res = await this.limiter.run(() =>
        withRetry(
          async () => {
            try {
              return await client.embeddings.create(
                { model: this.embeddingModel, input: batch, dimensions: this.dimensions },
                { signal },
              );
            } catch (err) {
              throw classifyOpenAiError(err);
            }
          },
          { retries: this.retries, signal, onRetry: (e, n, d) => logger.warn({ kind: e.kind, attempt: n, delayMs: d }, 'embedding retry') },
        ),
      );
      const vectors = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      if (vectors.length !== batch.length) throw new ProviderError('invalid_output', 'Embedding count mismatch', false);
      for (const v of vectors) {
        if (v.length !== this.dimensions) {
          throw new ProviderError(
            'invalid_output',
            `Embedding has ${v.length} dimensions, expected ${this.dimensions} (check EMBEDDING_DIMENSIONS)`,
            false,
          );
        }
      }
      out.push(...vectors);
    }
    return out;
  }

  async completeJson(req: JsonCompletionRequest): Promise<unknown> {
    const client = this.requireClient();
    const res = await this.limiter.run(() =>
      withRetry(
        async () => {
          try {
            return await client.chat.completions.create(
              {
                model: this.chatModel,
                messages: req.messages,
                temperature: 0.1,
                max_completion_tokens: req.maxOutputTokens ?? this.maxOutputTokens,
                response_format: {
                  type: 'json_schema',
                  json_schema: { name: req.schemaName, schema: req.schema, strict: true },
                },
              },
              { signal: req.signal },
            );
          } catch (err) {
            throw classifyOpenAiError(err);
          }
        },
        { retries: this.retries, signal: req.signal, onRetry: (e, n, d) => logger.warn({ kind: e.kind, attempt: n, delayMs: d }, 'completion retry') },
      ),
    );
    const choice = res.choices[0];
    if (choice?.finish_reason === 'length') throw new ProviderError('invalid_output', 'Model output was truncated', false);
    const refusal = (choice?.message as { refusal?: string | null })?.refusal;
    if (refusal) throw new ProviderError('invalid_output', 'Model refused to produce structured output', false);
    const content = choice?.message?.content;
    if (!content) throw new ProviderError('empty_response', 'Model returned an empty response', false);
    try {
      return JSON.parse(content);
    } catch {
      throw new ProviderError('invalid_output', 'Model returned malformed JSON', false);
    }
  }
}
