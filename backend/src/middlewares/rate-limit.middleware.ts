import { rateLimit, type Options } from 'express-rate-limit';
import { isTest } from '../config/env.ts';

function minutesUntil(resetTime: Date | undefined): number {
  if (!resetTime) return 15;
  return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60_000));
}

const shared: Partial<Options> = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (req, res) => {
    const info = (req as { rateLimit?: { resetTime?: Date } }).rateLimit;
    const minutes = minutesUntil(info?.resetTime);
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: `Demasiados intentos. Espera ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'} y vuelve a intentarlo`,
      },
    });
  },
};

// Contadores separados: los intentos fallidos de login no deben impedir que un cliente
// nuevo se registre. /refresh y /me no se limitan porque se llaman en cada carga.
export const loginRateLimiter = rateLimit({ ...shared, windowMs: 15 * 60 * 1000, limit: 10 });
export const registerRateLimiter = rateLimit({ ...shared, windowMs: 60 * 60 * 1000, limit: 10 });
