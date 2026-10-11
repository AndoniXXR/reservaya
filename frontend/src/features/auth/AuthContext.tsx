import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '@/api/auth';
import type { RegisterPayload, User } from '@/api/auth';
import { refreshAccessToken, tokenStore } from '@/api/client';
import { AuthContext, type AuthContextValue } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Al cargar la app, recuperar la sesión desde la cookie de refresh
  useEffect(() => {
    let cancelled = false;
    refreshAccessToken()
      .then((token) => (token ? authApi.fetchMe() : null))
      .then((me) => {
        if (!cancelled) setUserState(me);
      })
      .catch(() => {
        if (!cancelled) setUserState(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applySession = useCallback((session: authApi.SessionResponse) => {
    tokenStore.set(session.accessToken);
    setUserState(session.user);
    return session.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) =>
      applySession(await authApi.login({ email, password })),
    [applySession],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => applySession(await authApi.register(payload)),
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      tokenStore.set(null);
      setUserState(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, setUser: setUserState }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
