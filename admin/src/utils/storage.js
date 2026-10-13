/**
 * Namespaced localStorage helpers for DEMO data only. Every key starts with STORAGE_PREFIX,
 * and `clearDemoStorage` only removes keys with that prefix — never unrelated browser data.
 * Never store secrets, passwords or sensitive personal data here.
 */
export const STORAGE_PREFIX = 'ai_bajan_admin_demo_';

const memory = new Map(); // fallback when localStorage is unavailable (private mode, blocked)

function available() {
  try {
    const probe = `${STORAGE_PREFIX}probe`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readJSON(key, fallback) {
  const fullKey = STORAGE_PREFIX + key;
  try {
    const raw = available() ? window.localStorage.getItem(fullKey) : memory.get(fullKey);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback; // malformed JSON → defaults
  }
}

export function writeJSON(key, value) {
  const fullKey = STORAGE_PREFIX + key;
  const raw = JSON.stringify(value);
  try {
    if (available()) window.localStorage.setItem(fullKey, raw);
    else memory.set(fullKey, raw);
  } catch {
    memory.set(fullKey, raw); // quota exceeded etc.
  }
}

export function removeKey(key) {
  const fullKey = STORAGE_PREFIX + key;
  memory.delete(fullKey);
  try {
    window.localStorage.removeItem(fullKey);
  } catch {
    /* ignore */
  }
}

/** Remove only this dashboard's demo keys. */
export function clearDemoStorage() {
  for (const k of [...memory.keys()]) if (k.startsWith(STORAGE_PREFIX)) memory.delete(k);
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
