import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.ts';
import { logger } from './config/logger.ts';
import { healthRouter } from './modules/health/health.routes.ts';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.ts';

export function createApp() {
  const app = express();

  // Detrás de Caddy en producción: confiar en el primer proxy para IP real y protocolo
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      // Una línea por petición: método, ruta, estado y duración
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      customSuccessMessage: (req, res, responseTime) =>
        `${req.method} ${req.url} → ${res.statusCode} (${responseTime} ms)`,
      customErrorMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
    }),
  );

  app.use('/api/health', healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
