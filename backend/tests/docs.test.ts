import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';

const app = createApp();

describe('documentación de la API', () => {
  it('sirve el documento OpenAPI con todos los endpoints', async () => {
    const res = await request(app).get('/api/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    const paths = Object.keys(res.body.paths);
    for (const expected of [
      '/health',
      '/auth/register',
      '/auth/login',
      '/auth/refresh',
      '/auth/logout',
      '/auth/me',
      '/services',
      '/services/{id}',
      '/services/{id}/toggle',
      '/staff',
      '/staff/{id}',
      '/staff/{id}/toggle',
      '/staff/{id}/working-hours',
      '/staff/{id}/time-off',
      '/time-off/{id}',
      '/availability',
      '/appointments',
      '/appointments/mine',
      '/appointments/{id}/cancel',
      '/appointments/{id}/status',
      '/settings',
      '/stats/overview',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('sirve Swagger UI en /api/docs', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('swagger-ui');
  });
});
