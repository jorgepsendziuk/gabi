import type { AuthProvider } from '@refinedev/core';
import { apiFetch, getToken, setToken } from '../lib/api';

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const data = await apiFetch<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return { success: true, redirectTo: '/app' };
  },
  logout: async () => {
    setToken(null);
    return { success: true, redirectTo: '/' };
  },
  check: async () => {
    const token = getToken();
    if (!token) return { authenticated: false, redirectTo: '/login' };
    try {
      await apiFetch('/api/auth/me');
      return { authenticated: true };
    } catch {
      setToken(null);
      return { authenticated: false, redirectTo: '/login' };
    }
  },
  getIdentity: async () => {
    const user = await apiFetch<{ id: string; email: string; name?: string }>('/api/auth/me');
    return { id: user.id, name: user.name ?? user.email, email: user.email };
  },
  onError: async (error) => {
    if ((error as { statusCode?: number })?.statusCode === 401) {
      setToken(null);
      return { logout: true, redirectTo: '/login' };
    }
    return { error };
  },
};
