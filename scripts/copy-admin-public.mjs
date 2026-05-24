import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'apps/admin/dist');
const dest = join(root, 'public');

if (!existsSync(src)) {
  console.error('[copy-admin-public] Rode o build do admin antes:', src);
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('[copy-admin-public] OK → public/');
