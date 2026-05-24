import { createApp } from './create-app.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'unhandledRejection');
  process.exit(1);
});

const app = createApp();
const port = Number.parseInt(process.env.PORT ?? '4000', 10) || 4000;

const server = app.listen(port, '0.0.0.0', () => {
  logger.info({ port, nodeEnv: process.env.NODE_ENV }, 'GABI API listening');
});

server.on('error', (err) => {
  logger.fatal({ err, port }, 'failed to bind port');
  process.exit(1);
});
