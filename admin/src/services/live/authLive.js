/**
 * Real authentication: Supabase Auth (email + password) → the API's /admin/me decides whether
 * this person is an active AI Bajan administrator and with which role.
 */
import { ApiError } from '../mockApi';
import { api, supabase } from './http';

const SESSION_KEY = 'ai_bajan_admin_session';
let memory = null;

/** Server role → dashboard role (the dashboard calls content managers "content editors"). */
export const fromServerRole = (r) => (r === 'content_manager' ? 'content_editor' : r);
export const toServerRole = (r) => (r === 'content_editor' ? 'content_manager' : r);

export function toAdmin(me) {
  return {
    id: me.id,
    name: me.displayName || me.email,
    email: me.email,
    role: fromServerRole(me.role),
    title: '',
    status: 'active',
    permissions: me.permissions ?? [],
  };
}

function storages() {
  try {
    return [window.sessionStorage, window.localStorage];
  } catch {
    return [];
  }
}

export function getSession() {
  for (const s of storages()) {
    try {
      const raw = s.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.adminId && parsed.live) return parsed;
      }
    } catch {
      /* ignore malformed */
    }
  }
  return memory;
}

export function getSessionAdmin() {
  return getSession()?.admin ?? null;
}

export async function login({ email, password, remember }) {
  if (!supabase) throw new ApiError('Sign-in is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).', { status: 0, retryable: false });
  const { error } = await supabase.auth.signInWithPassword({ email: String(email).trim(), password });
  if (error) {
    throw new ApiError(error.status === 400 ? 'Incorrect email or password.' : 'Sign-in failed. Please try again.', { status: 401, retryable: false });
  }
  let me;
  try {
    me = await api('/admin/me');
  } catch (err) {
    await supabase.auth.signOut().catch(() => {});
    throw err.status === 403
      ? new ApiError('This account is not an active AI Bajan administrator.', { status: 403, retryable: false })
      : err;
  }
  const session = { adminId: me.id, admin: toAdmin(me), live: true, startedAt: new Date().toISOString() };
  memory = session;
  const [sessionStore, localStore] = storages();
  try {
    (remember ? localStore : sessionStore)?.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* memory session only */
  }
  return session;
}

export function logout() {
  memory = null;
  for (const s of storages()) {
    try {
      s.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
  supabase?.auth.signOut().catch(() => {});
}

export async function requestPasswordReset(email) {
  if (!supabase) throw new ApiError('Password reset is not configured.', { status: 0, retryable: false });
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
    redirectTo: `${window.location.origin}/login`,
  });
  // Same response whether or not the account exists (no account enumeration).
  if (error && error.status >= 500) throw new ApiError('Could not send the reset email. Please try again later.', { status: 503 });
  return { ok: true };
}

export const DEMO_ACCOUNT_EMAIL = '';
