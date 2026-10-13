/**
 * Authenticated HTTP client for the AI Bajan API (live mode).
 * The Supabase access token is attached as a Bearer token; the API verifies it and checks the
 * administrator's role server-side. Nothing secret is stored in this app.
 */
import { createClient } from '@supabase/supabase-js';
import { API_BASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/config/environment';
import { ApiError } from '../mockApi';

export const supabase =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ai_bajan_admin_auth' },
      })
    : null;

let onUnauthorized = () => {};
/** Called when the API rejects the session (expired / revoked) so the app can sign out. */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function accessToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function buildUrl(path, query) {
  if (!API_BASE_URL) throw new ApiError('The AI Bajan API URL is not configured (VITE_API_BASE_URL).', { status: 0, code: 'NO_API_URL', retryable: false });
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return url.toString();
}

/**
 * @param {string} path e.g. "/admin/listings"
 * @param {{ method?: string, query?: object, body?: unknown, form?: FormData, auth?: boolean, timeout?: number }} [opts]
 */
export async function api(path, { method = 'GET', query, body, form, auth = true, timeout = 30000 } = {}) {
  const headers = { Accept: 'application/json' };
  if (auth) {
    const token = await accessToken();
    if (!token) {
      onUnauthorized();
      throw new ApiError('Your session has expired. Please sign in again.', { status: 401, code: 'UNAUTHENTICATED', retryable: false });
    }
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
      credentials: 'omit',
    });
  } catch (err) {
    throw new ApiError(
      err?.name === 'AbortError' ? 'The server took too long to respond. Please try again.' : 'Could not reach the AI Bajan API. Check your connection.',
      { status: 0, code: err?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK', retryable: true },
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const e = data?.error ?? {};
    if (res.status === 401 && auth) onUnauthorized();
    const fieldErrors = Array.isArray(e.details) ? e.details.map((d) => `${d.field}: ${d.message}`).join('; ') : '';
    const message =
      res.status === 422 && fieldErrors
        ? `Please check: ${fieldErrors}`
        : e.message || (res.status >= 500 ? 'The AI Bajan API had a problem. Please try again.' : 'The request could not be completed.');
    const err = new ApiError(message, { status: res.status, code: e.code ?? `HTTP_${res.status}`, retryable: res.status >= 500 || res.status === 429 });
    err.details = e.details;
    err.requestId = e.requestId;
    throw err;
  }
  return data;
}

/** Fetch every page of a paginated admin list (pageSize 100). */
export async function getAll(path, query = {}) {
  const items = [];
  for (let page = 1; page <= 100; page++) {
    const res = await api(path, { query: { ...query, page, pageSize: 100 } });
    items.push(...(res?.items ?? []));
    if (!res?.totalPages || page >= res.totalPages) break;
  }
  return items;
}

export const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Date-only value for the API ("YYYY-MM-DD"). */
export const toDate = (v) => (v ? String(v).slice(0, 10) : undefined);
/** Drop undefined keys so PATCH only sends what changed. */
export const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
