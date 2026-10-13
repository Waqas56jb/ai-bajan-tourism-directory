/**
 * MOCK authentication — for the frontend demo only. It is NOT security.
 *
 * - Only the demo administrator email (shown on the login page) can sign in.
 * - Any password of 8+ characters is accepted for that demo account; no password is stored.
 * - The "session" is a small JSON record in local/session storage with no token or secret.
 *
 * Replace with real authentication (e.g. Supabase Auth via the Node.js API) and enforce
 * authorization server-side. Frontend route guards only change what is displayed.
 */
import { mockAdmins, CURRENT_ADMIN_ID } from '@/data/mockUsers';
import { ApiError, simulate } from './mockApi';
export const DEMO_ACCOUNT_EMAIL = 'admin.demo@example.com';
// Namespaced to this app, but outside the demo-data prefix so "Reset demo data" keeps you signed in.
const SESSION_KEY = 'ai_bajan_admin_session';

function storages() {
  const list = [];
  try {
    list.push(window.sessionStorage, window.localStorage);
  } catch {
    /* storage unavailable */
  }
  return list;
}

let memorySession = null;

export function getSession() {
  for (const s of storages()) {
    try {
      const raw = s.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.adminId) return parsed;
      }
    } catch {
      /* malformed → ignore */
    }
  }
  return memorySession;
}

export function getSessionAdmin() {
  const session = getSession();
  if (!session) return null;
  return mockAdmins.find((a) => a.id === session.adminId) ?? null;
}

export async function login({ email, password, remember }) {
  return simulate(
    () => {
      const normalized = String(email).trim().toLowerCase();
      if (normalized !== DEMO_ACCOUNT_EMAIL) {
        throw new ApiError('No demo account matches that email. Use the demo account shown below.', {
          status: 401,
          retryable: false,
        });
      }
      if (String(password).length < 8) {
        throw new ApiError('Password must be at least 8 characters.', { status: 401, retryable: false });
      }
      const session = { adminId: CURRENT_ADMIN_ID, startedAt: new Date().toISOString(), demo: true };
      memorySession = session;
      const [sessionStore, localStore] = storages();
      try {
        (remember ? localStore : sessionStore)?.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {
        /* keep memory session */
      }
      return session;
    },
    { latency: 600 },
  );
}

export function logout() {
  memorySession = null;
  for (const s of storages()) {
    try {
      s.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }
}

export async function requestPasswordReset(_email) {
  // No email is sent in the demo.
  return simulate(() => ({ ok: true, demo: true }), { latency: 700 });
}
