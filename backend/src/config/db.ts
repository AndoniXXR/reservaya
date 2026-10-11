import { logger } from './logger.ts';
import { prisma } from './prisma.ts';

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.warn({ err }, 'La base de datos no responde');
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  await prisma.$disconnect();
}
