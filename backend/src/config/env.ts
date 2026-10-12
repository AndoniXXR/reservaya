import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  APP_URL: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_GRACE_SECONDS: z.coerce.number().int().nonnegative().default(30),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  MAIL_FROM: z.string().default('ReservaYa <no-responder@reservaya.demo>'),
  /** URL pública del visor de correos de la demo (Mailpit); solo en el despliegue con Docker */
  DEMO_MAIL_URL: z.string().optional(),
  /** Si está definido, habilita /api/jobs/* para un planificador externo (Vercel Cron) */
  CRON_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    throw new Error(`Variables de entorno inválidas:\n${problems.join('\n')}`);
  }
  // En producción el secreto JWT debe ser largo y distinto del valor de ejemplo
  if (
    result.data.NODE_ENV === 'production' &&
    (result.data.JWT_ACCESS_SECRET.length < 32 ||
      result.data.JWT_ACCESS_SECRET.startsWith('cambia-esto'))
  ) {
    throw new Error(
      'JWT_ACCESS_SECRET debe tener al menos 32 caracteres aleatorios en producción (openssl rand -hex 32)',
    );
  }
  return result.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
