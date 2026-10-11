import bcrypt from 'bcrypt';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../src/config/prisma.ts';
import { REFRESH_COOKIE } from '../src/modules/auth/auth.controller.ts';

let counter = 0;
export const uniqueEmail = (prefix = 'user') => `${prefix}-${Date.now()}-${++counter}@test.dev`;

export const VALID_PASSWORD = 'Secreta123';

/** Borra todo lo que no sea configuración; cada archivo de test parte de cero. */
export async function resetDatabase() {
  await prisma.appointment.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.staffService.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
  // La configuración vuelve a los valores por defecto (se recrea al primer getSettings)
  await prisma.businessSettings.deleteMany();
}

export async function createUser(
  overrides: { email?: string; name?: string; role?: 'CLIENT' | 'ADMIN'; password?: string } = {},
) {
  const password = overrides.password ?? VALID_PASSWORD;
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? 'Usuario Test',
      email: overrides.email ?? uniqueEmail(overrides.role?.toLowerCase()),
      passwordHash: await bcrypt.hash(password, 4),
      role: overrides.role ?? 'CLIENT',
    },
  });
  return { ...user, password };
}

export interface Session {
  accessToken: string;
  refreshCookie: string;
  userId: string;
}

/** Inicia sesión y devuelve el access token y la cookie de refresh lista para reenviar. */
export async function loginAs(app: Express, email: string, password: string): Promise<Session> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return {
    accessToken: res.body.accessToken as string,
    refreshCookie: extractRefreshCookie(res.headers['set-cookie']),
    userId: res.body.user.id as string,
  };
}

export async function createAndLogin(
  app: Express,
  overrides: Parameters<typeof createUser>[0] = {},
) {
  const user = await createUser(overrides);
  const session = await loginAs(app, user.email, user.password);
  return { user, ...session };
}

/** Devuelve `refresh_token=valor` (o la cabecera completa con atributos si `full` es true). */
export function extractRefreshCookie(
  setCookie: string | string[] | undefined,
  full = false,
): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!cookie) throw new Error('La respuesta no trae la cookie de refresh');
  return full ? cookie : cookie.split(';')[0]!;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
