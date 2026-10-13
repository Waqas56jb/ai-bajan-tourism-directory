import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler } from '@/services/live/http';
import * as auth from '@/services/authService';

const AuthContext = createContext(null);

/**
 * DEMO session state. Route guards built on this only change what the browser displays —
 * real authorization must be enforced by the backend.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => auth.getSession());

  const login = useCallback(async (credentials) => {
    const s = await auth.login(credentials);
    setSession(s);
    return s;
  }, []);

  const logout = useCallback(() => {
    auth.logout();
    setSession(null);
  }, []);

  // Live mode: an expired or revoked session (API 401) signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      auth.logout();
      setSession(null);
    });
  }, []);

  const value = useMemo(
    () => ({
      session,
      admin: session ? auth.getSessionAdmin() : null,
      login,
      logout,
      isAuthenticated: Boolean(session),
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>.');
  return ctx;
}
