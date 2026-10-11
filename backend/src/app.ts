import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.ts';
import { logger } from './config/logger.ts';
import { docsRouter } from './docs/docs.routes.ts';
import { healthRouter } from './modules/health/health.routes.ts';
import { appointmentsRouter } from './modules/appointments/appointments.routes.ts';
import { authRouter } from './modules/auth/auth.routes.ts';
import { availabilityRouter } from './modules/availability/availability.routes.ts';
import { servicesRouter } from './modules/services/services.routes.ts';
import { settingsRouter } from './modules/settings/settings.routes.ts';
import { staffRouter, timeOffRouter } from './modules/staff/staff.routes.ts';
import { statsRouter } from './modules/stats/stats.routes.ts';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.ts';

export function createApp() {
  const app = express();

  // Detrás de Caddy en producción: confiar en el primer proxy para IP real y protocolo
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
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
  app.use('/api/auth', authRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/services', servicesRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/time-off', timeOffRouter);
  app.use('/api/availability', availabilityRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api', docsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
