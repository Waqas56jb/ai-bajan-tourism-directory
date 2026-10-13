/**
 * Thin fetch wrapper for the future AI Bajan Node.js API.
 * - Configurable base URL (VITE_API_BASE_URL)
 * - JSON in / JSON out, request timeout, consistent ApiError
 * - Never exposes raw server stack traces to the UI
 */
import { API_BASE_URL } from './config';

export class ApiError extends Error {
  /**
   * @param {string} message user-safe message
   * @param {{ status?: number, code?: string, retryable?: boolean }} [info]
   */
  constructor(message, { status = 0, code = 'UNKNOWN', retryable = true } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

function buildUrl(path, query) {
  if (!API_BASE_URL) {
    throw new ApiError('The AI Bajan API is not configured.', {
      code: 'NO_API_URL',
      retryable: false,
    });
  }
  const url = new URL(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
  }
  return url.toString();
}

export async function request(
  path,
  { method = 'GET', query, body, signal, headers = {}, timeout = DEFAULT_TIMEOUT_MS } = {},
) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException('Timeout', 'TimeoutError')),
    timeout,
  );
  const onAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      credentials: 'omit',
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json().catch(() => null) : null;

    if (!response.ok) {
      const message =
        response.status === 404
          ? 'We couldn’t find what you were looking for.'
          : response.status === 429
            ? 'Too many requests — please wait a moment and try again.'
            : response.status === 503 && typeof data?.error?.message === 'string'
              ? data.error.message
              : response.status >= 500
              ? 'The AI Bajan service is having trouble right now.'
              : (typeof data?.error?.message === 'string' && data.error.message) ||
                (typeof data?.message === 'string' && data.message) ||
                'The request could not be completed.';
      throw new ApiError(message, {
        status: response.status,
        code: data?.error?.code ?? data?.code ?? `HTTP_${response.status}`,
        retryable: response.status >= 500 || response.status === 429,
      });
    }
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      if (signal?.aborted) throw error; // caller cancelled (e.g. React Query) — let it propagate
      throw new ApiError('The request took too long. Please try again.', { code: 'TIMEOUT' });
    }
    throw new ApiError('We couldn’t reach AI Bajan. Check your connection and try again.', {
      code: 'NETWORK',
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
};
