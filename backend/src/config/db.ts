import { Pool } from 'pg';
import { env } from './env.ts';
import { logger } from './logger.ts';

// Pool compartido de PostgreSQL. En la fase 2 Prisma se conectará a través de este mismo pool.
export const pool = new Pool({ connectionString: env.DATABASE_URL });

pool.on('error', (err) => {
  logger.error({ err }, 'Error en una conexión inactiva del pool');
});

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (err) {
    logger.warn({ err }, 'La base de datos no responde');
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
