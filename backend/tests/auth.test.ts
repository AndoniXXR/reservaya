import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { prisma } from '../src/config/prisma.ts';
import { requireAuth, requireRole } from '../src/middlewares/auth.middleware.ts';
import { errorHandler } from '../src/middlewares/error.middleware.ts';
import { REFRESH_COOKIE } from '../src/modules/auth/auth.controller.ts';
import {
  VALID_PASSWORD,
  bearer,
  createAndLogin,
  createUser,
  extractRefreshCookie,
  loginAs,
  resetDatabase,
  uniqueEmail,
} from './helpers.ts';

const app = createApp();

beforeAll(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /api/auth/register', () => {
  it('crea un cliente y devuelve sesión', async () => {
    const email = uniqueEmail('nuevo');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Nuevo Cliente', email, password: VALID_PASSWORD, phone: '+502 5555 1234' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, name: 'Nuevo Cliente', role: 'CLIENT' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.accessToken).toEqual(expect.any(String));
    const cookie = extractRefreshCookie(res.headers['set-cookie'], true);
    expect(cookie).toContain('refresh_token=');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
  });

  it('rechaza un correo duplicado con 409', async () => {
    const user = await createUser();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Otro', email: user.email.toUpperCase(), password: VALID_PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('devuelve 400 con detalle por campo cuando los datos son inválidos', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'no-es-correo', password: 'soloLetras' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toMatchObject({
      name: expect.any(String),
      email: expect.any(String),
      password: expect.stringContaining('número'),
    });
  });

  it('ignora el rol enviado: siempre crea CLIENT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Intruso', email: uniqueEmail(), password: VALID_PASSWORD, role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CLIENT');
  });
});

describe('POST /api/auth/login', () => {
  it('devuelve 401 con credenciales inválidas', async () => {
    const user = await createUser();
    const wrong = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'Incorrecta1' });
    expect(wrong.status).toBe(401);

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nadie'), password: VALID_PASSWORD });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('devuelve access token y cookie con credenciales válidas', async () => {
    const user = await createUser();
    const session = await loginAs(app, user.email, user.password);
    expect(session.accessToken).toEqual(expect.any(String));
    expect(session.refreshCookie).toMatch(/^refresh_token=/);
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve 401 sin token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('devuelve 401 con token inválido', async () => {
    const res = await request(app).get('/api/auth/me').set(bearer('token-falso'));
    expect(res.status).toBe(401);
  });

  it('devuelve el usuario actual sin datos sensibles', async () => {
    const { user, accessToken } = await createAndLogin(app);
    const res = await request(app).get('/api/auth/me').set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email });
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });
});

describe('PATCH /api/auth/me', () => {
  it('edita nombre y teléfono', async () => {
    const { accessToken } = await createAndLogin(app);
    const res = await request(app)
      .patch('/api/auth/me')
      .set(bearer(accessToken))
      .send({ name: 'Nombre Nuevo', phone: '+502 4444 0000' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Nombre Nuevo', phone: '+502 4444 0000' });
  });

  it('rechaza un cuerpo vacío', async () => {
    const { accessToken } = await createAndLogin(app);
    const res = await request(app).patch('/api/auth/me').set(bearer(accessToken)).send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/refresh', () => {
  it('devuelve 401 sin cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('rota el token: emite uno nuevo y el anterior queda revocado', async () => {
    const { refreshCookie, userId } = await createAndLogin(app);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));

    const newCookie = extractRefreshCookie(res.headers['set-cookie']);
    expect(newCookie).not.toBe(refreshCookie);

    const tokens = await prisma.refreshToken.findMany({ where: { userId } });
    expect(tokens).toHaveLength(2);
    expect(tokens.filter((t) => t.revokedAt !== null)).toHaveLength(1);
    expect(tokens.find((t) => t.revokedAt !== null)?.replacedById).toBe(
      tokens.find((t) => t.revokedAt === null)?.id,
    );
  });

  it('acepta un token recién rotado dentro del periodo de gracia', async () => {
    const { refreshCookie } = await createAndLogin(app);
    await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    const again = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(again.status).toBe(200);
  });

  it('fuera de la gracia detecta reutilización y revoca todos los tokens del usuario', async () => {
    const { refreshCookie, userId } = await createAndLogin(app);
    const first = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    const freshCookie = extractRefreshCookie(first.headers['set-cookie']);

    // Simular que la rotación ocurrió hace un minuto
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    const reuse = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(reuse.status).toBe(401);
    expect(extractRefreshCookie(reuse.headers['set-cookie'])).toBe(`${REFRESH_COOKIE}=`);

    const legit = await request(app).post('/api/auth/refresh').set('Cookie', freshCookie);
    expect(legit.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revoca el token y borra la cookie', async () => {
    const { refreshCookie } = await createAndLogin(app);
    const res = await request(app).post('/api/auth/logout').set('Cookie', refreshCookie);
    expect(res.status).toBe(204);
    expect(extractRefreshCookie(res.headers['set-cookie'])).toBe(`${REFRESH_COOKIE}=`);

    const after = await request(app).post('/api/auth/refresh').set('Cookie', refreshCookie);
    expect(after.status).toBe(401);
  });
});

describe('requireRole', () => {
  const adminOnly = express();
  adminOnly.get('/admin', requireAuth, requireRole('ADMIN'), (_req, res) => {
    res.json({ ok: true });
  });
  adminOnly.use(errorHandler);

  it('un cliente recibe 403 en rutas de admin', async () => {
    const { accessToken } = await createAndLogin(app);
    const res = await request(adminOnly).get('/admin').set(bearer(accessToken));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('un admin accede', async () => {
    const { accessToken } = await createAndLogin(app, { role: 'ADMIN' });
    const res = await request(adminOnly).get('/admin').set(bearer(accessToken));
    expect(res.status).toBe(200);
  });
});
