import { createApp } from './app.ts';
import { env } from './config/env.ts';
import { logger } from './config/logger.ts';
import { closeDatabase } from './config/db.ts';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  logger.info(`Señal ${signal} recibida, cerrando...`);
  server.close(() => {
    void closeDatabase().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
