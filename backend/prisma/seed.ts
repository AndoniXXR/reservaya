import { prisma } from '../src/config/prisma.ts';
import { logger } from '../src/config/logger.ts';
import { runSeed } from '../src/db/seed-data.ts';

runSeed()
  .catch((err: unknown) => {
    logger.error({ err }, 'El seed falló');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
