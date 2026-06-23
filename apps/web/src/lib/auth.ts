'use client';

import { createContext, useContext } from 'react';
import type { User } from '@shacky/shared';

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<{ requireTotp?: boolean }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  login: async () => ({}),
  logout: async () => {},
  refresh: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function hasRole(user: User | null, ...roles: string[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

export function canEdit(user: User | null): boolean {
  return hasRole(user, 'superadmin', 'editor', 'author');
}

export function canAdmin(user: User | null): boolean {
  return hasRole(user, 'superadmin', 'editor');
}
