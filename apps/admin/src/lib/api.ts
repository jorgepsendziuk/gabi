const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function getToken(): string | null {
  return localStorage.getItem('gabi_token');
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem('gabi_token', token);
  else localStorage.removeItem('gabi_token');
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = (err as { error?: string }).error ?? res.statusText ?? 'Erro na requisição';
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
