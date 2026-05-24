/**
 * Deploy Vercel unificado (GABI_VERCEL_UNIFIED): API + admin no mesmo domínio — VITE_API_URL opcional.
 * Deploy só do admin: defina VITE_API_URL com a URL externa da API.
 */
const unified =
  process.env.GABI_VERCEL_UNIFIED === '1' ||
  process.env.VITE_VERCEL_UNIFIED === '1';

if (process.env.VERCEL === '1' && !process.env.VITE_API_URL?.trim() && !unified) {
  console.error(`
[build] VITE_API_URL não definida e modo unificado ausente (GABI_VERCEL_UNIFIED / VITE_VERCEL_UNIFIED).

Use o vercel.json da raiz (build unificado) OU defina VITE_API_URL com a API externa.
`);
  process.exit(1);
}
