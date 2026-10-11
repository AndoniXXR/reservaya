import { Router, type RequestHandler } from 'express';
import { env } from '../config/env.ts';
import { runSeed } from '../db/seed-data.ts';
import { AppError } from '../utils/errors.ts';
import { runReminderPass, tomorrowWindow } from './reminders.job.ts';

/**
 * Endpoints para plataformas sin procesos persistentes (Vercel Cron): el planificador
 * externo los llama con `Authorization: Bearer <CRON_SECRET>`. En el servidor Docker
 * los jobs corren con node-cron y estas rutas simplemente no se usan.
 */
const requireCronSecret: RequestHandler = (req, _res, next) => {
  if (!env.CRON_SECRET) {
    next(AppError.notFound('La ruta no existe'));
    return;
  }
  if (req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
    next(AppError.unauthorized());
    return;
  }
  next();
};

export const jobsRouter = Router();
jobsRouter.use(requireCronSecret);

// Una vez al día por la mañana: recordatorios de todas las citas de mañana
jobsRouter.get('/reminders', async (_req, res) => {
  const now = new Date();
  const sent = await runReminderPass(now, await tomorrowWindow(now));
  res.json({ sent });
});

// Reinicio nocturno de la demo pública
jobsRouter.get('/demo-reset', async (_req, res) => {
  if (!env.DEMO_MODE) throw AppError.forbidden('Solo disponible en modo demo');
  await runSeed();
  res.json({ reset: true });
});
