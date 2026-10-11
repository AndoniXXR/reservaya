import cron from 'node-cron';
import { runSeed } from '../db/seed-data.ts';
import { logger } from '../config/logger.ts';

/** En la demo pública los datos vuelven al estado inicial todas las noches a las 03:00. */
export function startDemoResetJob(timezone: string) {
  cron.schedule(
    '0 3 * * *',
    () => {
      runSeed()
        .then(() => logger.info('Datos de la demo reiniciados'))
        .catch((err: unknown) => logger.error({ err }, 'No se pudieron reiniciar los datos'));
    },
    { timezone },
  );
  logger.info('Job de reinicio de la demo programado (03:00 cada día)');
}
