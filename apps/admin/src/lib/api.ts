/** URL pública da API Express. Vazio em dev usa proxy do Vite (/api → :4000). */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Admin estático sem API no mesmo host (405 em POST /api). Unificado na Vercel não precisa de VITE_API_URL. */
export function isApiMisconfigured(): boolean {
  if (!import.meta.env.PROD || API_BASE) return false;
  if (import.meta.env.VITE_VERCEL_UNIFIED === 'true' || import.meta.env.VITE_VERCEL_UNIFIED === '1') {
    return false;
  }
  return true;
}

export function getToken(): string | null {
  return localStorage.getItem('gabi_token');
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem('gabi_token', token);
  else localStorage.removeItem('gabi_token');
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (isApiMisconfigured()) {
    throw new Error(
      'API não configurada: defina VITE_API_URL no deploy (URL da API em Cloud Run/Railway) e faça rebuild. ' +
        'Chamadas para /api neste site retornam 405 porque só o frontend está na Vercel.',
    );
  }

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
    const detail = (err as { error?: string }).error ?? res.statusText ?? 'Erro na requisição';
    const hint =
      res.status === 405
        ? ' (método HTTP não permitido — confira se a API está rodando em :4000 e se VITE_API_URL não aponta para o host errado)'
        : res.status === 502 || res.status === 503
          ? ' (API indisponível — rode pnpm dev na raiz do projeto)'
          : '';
    throw new Error(`[${res.status}] ${detail}${hint}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
