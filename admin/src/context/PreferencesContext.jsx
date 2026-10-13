import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { readAccountSettingsSync } from '@/services/settingsService';

const PreferencesContext = createContext(null);

function resolveTheme(pref) {
  if (pref === 'dark' || pref === 'light') return pref;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** UI preferences: theme (light/dark/system) and sidebar collapse state. */
export function PreferencesProvider({ children }) {
  const [theme, setThemeState] = useState(() => readAccountSettingsSync().theme ?? 'system');
  const [collapsed, setCollapsed] = useLocalStorage('sidebar_collapsed', false);

  useEffect(() => {
    const apply = () => document.documentElement.setAttribute('data-theme', resolveTheme(theme));
    apply();
    if (theme !== 'system' || !window.matchMedia) return undefined;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener?.('change', apply);
    return () => mql.removeEventListener?.('change', apply);
  }, [theme]);

  const setTheme = useCallback((t) => setThemeState(t), []);

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme: resolveTheme(theme), collapsed, setCollapsed }),
    [theme, setTheme, collapsed, setCollapsed],
  );
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>.');
  return ctx;
}
