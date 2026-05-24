#!/usr/bin/env node
/**
 * Sobe API (:4000) + Admin (:5173) em um único comando.
 * Usa Turborepo para build das dependências do workspace antes do watch.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const banner = `
\x1b[1mGABI\x1b[0m — dev monorepo
  \x1b[36mAPI\x1b[0m   http://localhost:4000/health
  \x1b[35mAdmin\x1b[0m http://localhost:5173
  Login: admin@gabi.local / admin123
  \x1b[90mCtrl+C para parar\x1b[0m
`;

console.log(banner);

const child = spawn(
  'pnpm',
  ['exec', 'turbo', 'run', 'dev', '--filter=@gabi/api', '--filter=@gabi/admin'],
  {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  },
);

function shutdown(signal) {
  if (!child.killed) child.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal === 'SIGINT' || signal === 'SIGTERM') {
    process.exit(0);
    return;
  }
  process.exit(code ?? 1);
});
