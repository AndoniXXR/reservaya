import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { prisma } from '../src/config/prisma.ts';
import { bearer, createAndLogin, resetDatabase } from './helpers.ts';

const app = createApp();
let admin = '';
let client = '';

beforeAll(async () => {
  await resetDatabase();
  admin = (await createAndLogin(app, { role: 'ADMIN' })).accessToken;
  client = (await createAndLogin(app)).accessToken;
});
afterAll(() => prisma.$disconnect());

const validService = {
  name: 'Corte',
  description: 'Corte clásico',
  durationMinutes: 30,
  price: 75,
};

describe('servicios', () => {
  it('un cliente no puede crear servicios (403)', async () => {
    const res = await request(app).post('/api/services').set(bearer(client)).send(validService);
    expect(res.status).toBe(403);
  });

  it('sin sesión no se puede crear (401)', async () => {
    const res = await request(app).post('/api/services').send(validService);
    expect(res.status).toBe(401);
  });

  it('el admin crea, edita y desactiva un servicio', async () => {
    const created = await request(app).post('/api/services').set(bearer(admin)).send(validService);
    expect(created.status).toBe(201);
    expect(created.body.service).toMatchObject({ ...validService, active: true });

    const id = created.body.service.id as string;
    const updated = await request(app)
      .patch(`/api/services/${id}`)
      .set(bearer(admin))
      .send({ price: 80.5 });
    expect(updated.status).toBe(200);
    expect(updated.body.service.price).toBe(80.5);

    const toggled = await request(app).patch(`/api/services/${id}/toggle`).set(bearer(admin));
    expect(toggled.body.service.active).toBe(false);

    // Público: solo activos. Admin con ?all=true: todos.
    const publicList = await request(app).get('/api/services');
    expect(publicList.body.services.map((s: { id: string }) => s.id)).not.toContain(id);
    const adminList = await request(app).get('/api/services?all=true').set(bearer(admin));
    expect(adminList.body.services.map((s: { id: string }) => s.id)).toContain(id);
    const clientAll = await request(app).get('/api/services?all=true').set(bearer(client));
    expect(clientAll.body.services.map((s: { id: string }) => s.id)).not.toContain(id);
  });

  it('rechaza duraciones que no son múltiplo del intervalo', async () => {
    const res = await request(app)
      .post('/api/services')
      .set(bearer(admin))
      .send({ ...validService, durationMinutes: 40 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.durationMinutes).toContain('múltiplo de 15');
  });

  it('devuelve 404 para un servicio inexistente', async () => {
    const res = await request(app).get('/api/services/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('profesionales', () => {
  let serviceId = '';
  let staffId = '';

  beforeAll(async () => {
    const service = await prisma.service.create({
      data: { name: 'Barba', durationMinutes: 15, price: 40 },
    });
    serviceId = service.id;
  });

  it('crea un profesional con servicios', async () => {
    const res = await request(app)
      .post('/api/staff')
      .set(bearer(admin))
      .send({ name: 'Carlos', bio: 'Barbero', serviceIds: [serviceId] });
    expect(res.status).toBe(201);
    expect(res.body.staff.services).toHaveLength(1);
    expect(res.body.staff.services[0]).toMatchObject({ id: serviceId, price: 40 });
    staffId = res.body.staff.id;
  });

  it('filtra por servicio en el listado público', async () => {
    const withService = await request(app).get(`/api/staff?serviceId=${serviceId}`);
    expect(withService.body.staff.map((s: { id: string }) => s.id)).toContain(staffId);

    const other = await prisma.service.create({
      data: { name: 'Otro', durationMinutes: 30, price: 10 },
    });
    const without = await request(app).get(`/api/staff?serviceId=${other.id}`);
    expect(without.body.staff).toHaveLength(0);
  });

  it('reemplaza el horario semanal', async () => {
    const res = await request(app)
      .put(`/api/staff/${staffId}/working-hours`)
      .set(bearer(admin))
      .send({
        blocks: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
          { dayOfWeek: 2, startTime: '10:00', endTime: '19:00' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.workingHours).toHaveLength(3);
    expect(res.body.affectedAppointments).toEqual([]);

    const list = await request(app).get(`/api/staff/${staffId}/working-hours`).set(bearer(admin));
    expect(list.body.workingHours).toHaveLength(3);
  });

  it('rechaza bloques traslapados el mismo día', async () => {
    const res = await request(app)
      .put(`/api/staff/${staffId}/working-hours`)
      .set(bearer(admin))
      .send({
        blocks: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          { dayOfWeek: 1, startTime: '12:00', endTime: '18:00' },
        ],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.details.blocks).toBe('Los bloques del lunes se traslapan');
  });

  it('rechaza un bloque cuyo fin no es posterior al inicio', async () => {
    const res = await request(app)
      .put(`/api/staff/${staffId}/working-hours`)
      .set(bearer(admin))
      .send({ blocks: [{ dayOfWeek: 1, startTime: '13:00', endTime: '09:00' }] });
    expect(res.status).toBe(400);
  });

  it('crea y borra días libres, avisando de citas afectadas', async () => {
    const clientUser = await prisma.user.findFirstOrThrow({ where: { role: 'CLIENT' } });
    const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    await prisma.appointment.create({
      data: {
        clientId: clientUser.id,
        staffId,
        serviceId,
        startsAt,
        endsAt,
        priceAtBooking: 40,
      },
    });

    const created = await request(app)
      .post(`/api/staff/${staffId}/time-off`)
      .set(bearer(admin))
      .send({
        startsAt: new Date(startsAt.getTime() - 60 * 60 * 1000).toISOString(),
        endsAt: new Date(endsAt.getTime() + 60 * 60 * 1000).toISOString(),
        reason: 'Cita médica',
      });
    expect(created.status).toBe(201);
    expect(created.body.affectedAppointments).toHaveLength(1);
    expect(created.body.affectedAppointments[0].serviceName).toBe('Barba');

    const list = await request(app).get(`/api/staff/${staffId}/time-off`).set(bearer(admin));
    expect(list.body.timeOff).toHaveLength(1);

    const removed = await request(app)
      .delete(`/api/time-off/${created.body.timeOff.id}`)
      .set(bearer(admin));
    expect(removed.status).toBe(204);
  });

  it('al desactivar devuelve las citas futuras confirmadas', async () => {
    const res = await request(app).patch(`/api/staff/${staffId}/toggle`).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.staff.active).toBe(false);
    expect(res.body.affectedAppointments).toHaveLength(1);

    const reactivated = await request(app).patch(`/api/staff/${staffId}/toggle`).set(bearer(admin));
    expect(reactivated.body.staff.active).toBe(true);
    expect(reactivated.body.affectedAppointments).toEqual([]);
  });
});

describe('configuración', () => {
  it('es pública en lectura y solo admin en escritura', async () => {
    const pub = await request(app).get('/api/settings');
    expect(pub.status).toBe(200);
    expect(pub.body.settings).toMatchObject({ timezone: 'America/Guatemala' });
    expect(pub.body.settings).not.toHaveProperty('id');

    const forbidden = await request(app)
      .patch('/api/settings')
      .set(bearer(client))
      .send({ cancellationHours: 6 });
    expect(forbidden.status).toBe(403);

    const ok = await request(app)
      .patch('/api/settings')
      .set(bearer(admin))
      .send({ cancellationHours: 6 });
    expect(ok.status).toBe(200);
    expect(ok.body.settings.cancellationHours).toBe(6);
  });

  it('no permite un intervalo incompatible con los servicios activos', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .set(bearer(admin))
      .send({ slotIntervalMinutes: 60 });
    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain('múltiplo de 60');
  });
});
