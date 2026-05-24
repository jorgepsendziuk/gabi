/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_VERCEL_UNIFIED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
