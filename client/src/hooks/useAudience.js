import { useCallback, useSyncExternalStore } from 'react';

/** "I live here" / "I'm visiting" preference. Remembered in this browser only; defaults to resident. */
const KEY = 'ai_bajan_audience';
const listeners = new Set();

export function getAudience() {
  try {
    return localStorage.getItem(KEY) === 'visitor' ? 'visitor' : 'resident';
  } catch {
    return 'resident';
  }
}

function setStored(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* storage unavailable: preference lasts for this page view */
  }
  listeners.forEach((l) => l());
}

export function useAudience() {
  const audience = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getAudience,
    () => 'resident',
  );
  const setAudience = useCallback((v) => setStored(v === 'visitor' ? 'visitor' : 'resident'), []);
  return [audience, setAudience];
}
