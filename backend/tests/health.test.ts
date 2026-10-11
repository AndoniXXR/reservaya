import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.ts';
import { closeDatabase } from '../src/config/db.ts';

const app = createApp();

afterAll(async () => {
  await closeDatabase();
});

describe('GET /api/health', () => {
  it('responde ok con la base de datos disponible', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });
});

describe('rutas inexistentes', () => {
  it('devuelve 404 con el formato de error uniforme', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
