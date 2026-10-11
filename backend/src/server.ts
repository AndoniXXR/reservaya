import { createApp } from './app.ts';
import { closeDatabase } from './config/db.ts';
import { env } from './config/env.ts';
import { logger } from './config/logger.ts';
import { startDemoResetJob } from './jobs/demo-reset.job.ts';
import { startReminderJob } from './jobs/reminders.job.ts';
import { getSettings } from './modules/settings/settings.service.ts';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

startReminderJob();
if (env.DEMO_MODE) {
  getSettings()
    .then((settings) => startDemoResetJob(settings.timezone))
    .catch((err: unknown) => logger.error({ err }, 'No se pudo programar el reinicio de la demo'));
}

function shutdown(signal: string) {
  logger.info(`Señal ${signal} recibida, cerrando...`);
  server.close(() => {
    void closeDatabase().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
