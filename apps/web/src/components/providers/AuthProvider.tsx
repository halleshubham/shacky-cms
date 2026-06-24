'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext } from '@/lib/auth';
import type { User } from '@shacky/shared';
import { api } from '@/lib/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<User>('/api/auth/me');
      setUser(me);
    } catch (err: any) {
      if (err?.statusCode === 401) {
        // Access token may have expired — try the refresh token cookie
        try {
          await api.post('/api/auth/refresh');
          const me = await api.get<User>('/api/auth/me');
          setUser(me);
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Proactively refresh every 7 hours so the 8h access token never expires mid-session
    const id = setInterval(refresh, 7 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, totpCode?: string) => {
    const result = await api.post<{ user?: User; requireTotp?: boolean; accessToken?: string }>(
      '/api/auth/login',
      { email, password, totpCode },
    );
    if (result.requireTotp) return { requireTotp: true };
    if (result.user) setUser(result.user);
    return {};
  }, []);

  const logout = useCallback(async () => {
    await api.post('/api/auth/logout').catch(() => {});
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
