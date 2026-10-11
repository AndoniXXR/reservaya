import { defineConfig } from 'prisma/config';

// El .env vive en la raíz del monorepo. En CI no existe: las variables llegan del entorno.
try {
  process.loadEnvFile('../.env');
} catch {
  // sin archivo .env
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
