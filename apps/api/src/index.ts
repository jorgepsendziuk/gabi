import { createApp } from './create-app.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const app = createApp();
const port = Number(process.env.PORT ?? 4000);

app.listen(port, '0.0.0.0', () => {
  logger.info({ port }, 'GABI API listening');
});
