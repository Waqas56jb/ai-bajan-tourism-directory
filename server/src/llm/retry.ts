/** Classified provider failure. `retryable` drives the backoff loop. */
export class ProviderError extends Error {
  constructor(
    public readonly kind:
      | 'timeout'
      | 'rate_limited'
      | 'server_error'
      | 'network'
      | 'auth'
      | 'bad_request'
      | 'model_not_found'
      | 'context_length'
      | 'invalid_output'
      | 'empty_response'
      | 'not_configured'
      | 'unknown',
    message: string,
    public readonly retryable: boolean,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (err: ProviderError, attempt: number, delayMs: number) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Full-jitter exponential backoff delay for attempt n (1-based). */
export function backoffDelay(attempt: number, base = 300, max = 8000, random = Math.random) {
  const cap = Math.min(max, base * 2 ** (attempt - 1));
  return Math.round(random() * cap);
}

/** Retries only ProviderErrors marked retryable; everything else is rethrown immediately. */
export async function withRetry<T>(fn: (attempt: number) => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      const pe = err instanceof ProviderError ? err : null;
      if (!pe || !pe.retryable || attempt > opts.retries || opts.signal?.aborted) throw err;
      const delay = Math.max(pe.retryAfterMs ?? 0, backoffDelay(attempt, opts.baseDelayMs, opts.maxDelayMs));
      opts.onRetry?.(pe, attempt, delay);
      await sleep(Math.min(delay, opts.maxDelayMs ?? 8000));
    }
  }
}

/** Minimal counting semaphore to cap concurrent provider calls per process. */
export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];
  constructor(private readonly limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((r) => this.waiters.push(r));
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }
}
