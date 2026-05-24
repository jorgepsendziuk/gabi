import { config } from 'dotenv';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import pino from 'pino';
import { pinoHttp } from 'pino-http';
import { authRouter } from './routes/auth.js';
import { introspectRouter } from './routes/introspect.js';
import { datasourcesRouter } from './routes/datasources.js';
import { runtimeRouter } from './routes/runtime.js';
import { generatorRouter } from './routes/generator.js';
import { auditRouter } from './routes/audit.js';
import { connectionsRouter } from './routes/connections.js';
import { odkRouter } from './routes/odk.js';
import { modulesRouter } from './routes/modules.js';
import { errorHandler } from './middleware/error.js';

if (process.env.NODE_ENV !== 'production') {
  config({ override: true });
  config({ path: '.env.local', override: true });
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(pinoHttp({ logger }));
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', name: 'GABI API', version: '0.1.0' });
});

app.use('/api/auth', authRouter);
app.use('/api/introspect', introspectRouter);
app.use('/api/datasources', datasourcesRouter);
app.use('/api/runtime', runtimeRouter);
app.use('/api/generator', generatorRouter);
app.use('/api/audit', auditRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/odk', odkRouter);
app.use('/api/modules', modulesRouter);

app.use(errorHandler);

app.listen(port, '0.0.0.0', () => {
  logger.info({ port }, 'GABI API listening');
});
