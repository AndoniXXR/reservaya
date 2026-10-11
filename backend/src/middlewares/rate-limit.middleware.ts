import { rateLimit } from 'express-rate-limit';
import { isTest } from '../config/env.ts';

// Solo para login y registro: /refresh y /me se llaman en cada carga de la app.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'RATE_LIMITED', message: 'Demasiados intentos, espera unos minutos' },
    });
  },
});
