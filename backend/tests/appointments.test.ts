import { TZDate } from '@date-fns/tz';
import { addDays, addMinutes } from 'date-fns';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { prisma } from '../src/config/prisma.ts';
import { bearer, createAndLogin, resetDatabase } from './helpers.ts';

const app = createApp();
const TZ = 'America/Guatemala';

let admin = { accessToken: '', userId: '' };
let client = { accessToken: '', userId: '' };
let serviceId = '';
let staffId = '';

/** Próximo día (a partir de mañana) a las HH:mm hora de Guatemala, como instante UTC. */
function upcoming(time: string, daysAhead = 2): Date {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const base = addDays(TZDate.tz(TZ), daysAhead);
  return new Date(
    new TZDate(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, TZ).getTime(),
  );
}

beforeAll(async () => {
  await resetDatabase();
  admin = await createAndLogin(app, { role: 'ADMIN' });
  client = await createAndLogin(app);

  const service = await prisma.service.create({
    data: { name: 'Corte', durationMinutes: 30, price: 75 },
  });
  serviceId = service.id;
  const staff = await prisma.staff.create({
    data: {
      name: 'Carlos',
      services: { create: [{ serviceId }] },
      // Trabaja todos los días de 09:00 a 18:00 para que los tests no dependan del día
      workingHours: {
        create: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '09:00',
          endTime: '18:00',
        })),
      },
    },
  });
  staffId = staff.id;
});

beforeEach(async () => {
  await prisma.appointment.deleteMany();
});

afterAll(() => prisma.$disconnect());

const book = (token: string, startsAt: Date, extra: Record<string, unknown> = {}) =>
  request(app)
    .post('/api/appointments')
    .set(bearer(token))
    .send({ serviceId, staffId, startsAt: startsAt.toISOString(), ...extra });

describe('GET /api/availability', () => {
  it('devuelve slots del día con el profesional indicado', async () => {
    const date = upcoming('09:00').toISOString();
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(date));
    const res = await request(app).get(`/api/availability?serviceId=${serviceId}&date=${day}`);
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe(TZ);
    expect(res.body.slots[0]).toMatchObject({ staffId, staffName: 'Carlos', label: '09:00' });
    expect(res.body.slots.at(-1).label).toBe('17:30');
  });

  it('valida los parámetros', async () => {
    const res = await request(app).get('/api/availability?serviceId=x&date=hoy');
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('serviceId');
    expect(res.body.error.details).toHaveProperty('date');
  });
});

describe('POST /api/appointments', () => {
  it('reserva válida → 201 con el precio congelado', async () => {
    const res = await book(client.accessToken, upcoming('10:00'), { notes: 'Sin mucho volumen' });
    expect(res.status).toBe(201);
    expect(res.body.appointment).toMatchObject({
      status: 'CONFIRMED',
      priceAtBooking: 75,
      notes: 'Sin mucho volumen',
      service: { name: 'Corte' },
      staff: { name: 'Carlos' },
    });
    expect(new Date(res.body.appointment.endsAt).getTime()).toBe(
      addMinutes(upcoming('10:00'), 30).getTime(),
    );
  });

  it('sin sesión → 401', async () => {
    const res = await request(app).post('/api/appointments').send({});
    expect(res.status).toBe(401);
  });

  it('el admin no reserva como cliente → 403', async () => {
    const res = await book(admin.accessToken, upcoming('10:00'));
    expect(res.status).toBe(403);
  });

  it('servicio o profesional inexistente → 404 con mensaje claro', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const noService = await request(app)
      .post('/api/appointments')
      .set(bearer(client.accessToken))
      .send({ serviceId: missing, staffId, startsAt: upcoming('10:00').toISOString() });
    expect(noService.status).toBe(404);
    expect(noService.body.error.message).toBe('El servicio no existe');

    const noStaff = await request(app)
      .post('/api/appointments')
      .set(bearer(client.accessToken))
      .send({ serviceId, staffId: missing, startsAt: upcoming('10:00').toISOString() });
    expect(noStaff.status).toBe(404);
    expect(noStaff.body.error.message).toBe('El profesional no existe');
  });

  it('cuerpo sin Content-Type JSON → 415', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set(bearer(client.accessToken))
      .set('Content-Type', 'text/plain')
      .send('{"serviceId":"x"}');
    expect(res.status).toBe(415);
  });

  it('horario ocupado → 409', async () => {
    await book(client.accessToken, upcoming('10:00'));
    const other = await createAndLogin(app);
    const res = await book(other.accessToken, upcoming('10:15'));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('fuera del horario laboral → 422', async () => {
    const res = await book(client.accessToken, upcoming('18:00'));
    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain('jornada');
  });

  it('con menos de la anticipación mínima → 422', async () => {
    const res = await book(client.accessToken, addMinutes(new Date(), 30));
    expect(res.status).toBe(422);
  });

  it('horario no alineado al intervalo → 422', async () => {
    const res = await book(client.accessToken, addMinutes(upcoming('10:00'), 7));
    expect(res.status).toBe(422);
  });

  it('durante un día libre → 422', async () => {
    const start = upcoming('09:00', 4);
    await prisma.timeOff.create({
      data: { staffId, startsAt: start, endsAt: addDays(start, 1), reason: 'Vacaciones' },
    });
    const res = await book(client.accessToken, upcoming('11:00', 4));
    expect(res.status).toBe(422);
    expect(res.body.error.message).toContain('no está disponible');
    await prisma.timeOff.deleteMany();
  });

  it('sexta cita futura → 422', async () => {
    for (const time of ['09:00', '10:00', '11:00', '12:00', '13:00']) {
      const res = await book(client.accessToken, upcoming(time));
      expect(res.status).toBe(201);
    }
    const sixth = await book(client.accessToken, upcoming('14:00'));
    expect(sixth.status).toBe(422);
    expect(sixth.body.error.message).toContain('5 citas');
  });

  it('concurrencia: 5 peticiones simultáneas al mismo horario → exactamente 1 éxito', async () => {
    const clients = await Promise.all(Array.from({ length: 5 }, () => createAndLogin(app)));
    const results = await Promise.all(clients.map((c) => book(c.accessToken, upcoming('15:00'))));
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it('concurrencia: un cliente con 4 citas lanza 5 reservas a horarios distintos → solo 1 éxito', async () => {
    for (const time of ['09:00', '10:00', '11:00', '12:00']) {
      await book(client.accessToken, upcoming(time));
    }
    const results = await Promise.all(
      ['13:00', '14:00', '15:00', '16:00', '17:00'].map((time) =>
        book(client.accessToken, upcoming(time)),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 422)).toHaveLength(4);
    expect(await prisma.appointment.count({ where: { clientId: client.userId } })).toBe(5);
  });
});

describe('GET /api/appointments/mine', () => {
  it('separa próximas e historial', async () => {
    await book(client.accessToken, upcoming('10:00'));
    await prisma.appointment.create({
      data: {
        clientId: client.userId,
        staffId,
        serviceId,
        startsAt: addDays(new Date(), -3),
        endsAt: addMinutes(addDays(new Date(), -3), 30),
        status: 'COMPLETED',
        priceAtBooking: 75,
      },
    });

    const upcomingRes = await request(app)
      .get('/api/appointments/mine?scope=upcoming')
      .set(bearer(client.accessToken));
    expect(upcomingRes.body.appointments).toHaveLength(1);
    expect(upcomingRes.body.appointments[0].status).toBe('CONFIRMED');

    const pastRes = await request(app)
      .get('/api/appointments/mine?scope=past')
      .set(bearer(client.accessToken));
    expect(pastRes.body.appointments).toHaveLength(1);
    expect(pastRes.body.appointments[0].status).toBe('COMPLETED');
  });
});

describe('PATCH /api/appointments/:id/cancel', () => {
  it('el cliente cancela con anticipación suficiente', async () => {
    const created = await book(client.accessToken, upcoming('10:00'));
    const res = await request(app)
      .patch(`/api/appointments/${created.body.appointment.id}/cancel`)
      .set(bearer(client.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.appointment).toMatchObject({ status: 'CANCELLED', cancelledBy: 'CLIENT' });
  });

  it('cancelación tardía por cliente → 422; por admin → 200', async () => {
    // Cita dentro de 3 horas (cancellationHours = 12)
    const soon = await prisma.appointment.create({
      data: {
        clientId: client.userId,
        staffId,
        serviceId,
        startsAt: addMinutes(new Date(), 180),
        endsAt: addMinutes(new Date(), 210),
        priceAtBooking: 75,
      },
    });
    const late = await request(app)
      .patch(`/api/appointments/${soon.id}/cancel`)
      .set(bearer(client.accessToken));
    expect(late.status).toBe(422);
    expect(late.body.error.message).toContain('12 horas');

    const byAdmin = await request(app)
      .patch(`/api/appointments/${soon.id}/cancel`)
      .set(bearer(admin.accessToken));
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.appointment.cancelledBy).toBe('ADMIN');
  });

  it('un cliente no puede cancelar citas ajenas', async () => {
    const created = await book(client.accessToken, upcoming('10:00'));
    const other = await createAndLogin(app);
    const res = await request(app)
      .patch(`/api/appointments/${created.body.appointment.id}/cancel`)
      .set(bearer(other.accessToken));
    expect(res.status).toBe(404);
  });

  it('una cita cancelada libera el horario', async () => {
    const created = await book(client.accessToken, upcoming('10:00'));
    await request(app)
      .patch(`/api/appointments/${created.body.appointment.id}/cancel`)
      .set(bearer(client.accessToken));
    const again = await book(client.accessToken, upcoming('10:00'));
    expect(again.status).toBe(201);
  });
});

describe('admin: listado y estados', () => {
  it('lista con filtros y paginación', async () => {
    await book(client.accessToken, upcoming('10:00'));
    await book(client.accessToken, upcoming('11:00'));

    const forbidden = await request(app).get('/api/appointments').set(bearer(client.accessToken));
    expect(forbidden.status).toBe(403);

    const inverted = await request(app)
      .get('/api/appointments?from=2026-12-01&to=2026-01-01')
      .set(bearer(admin.accessToken));
    expect(inverted.status).toBe(400);

    const res = await request(app)
      .get(`/api/appointments?staffId=${staffId}&status=CONFIRMED&pageSize=1`)
      .set(bearer(admin.accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 1, total: 2 });
    expect(res.body.data).toHaveLength(1);
  });

  it('solo marca COMPLETED / NO_SHOW cuando la cita ya empezó', async () => {
    const future = await book(client.accessToken, upcoming('10:00'));
    const early = await request(app)
      .patch(`/api/appointments/${future.body.appointment.id}/status`)
      .set(bearer(admin.accessToken))
      .send({ status: 'COMPLETED' });
    expect(early.status).toBe(422);

    const past = await prisma.appointment.create({
      data: {
        clientId: client.userId,
        staffId,
        serviceId,
        startsAt: addMinutes(new Date(), -60),
        endsAt: addMinutes(new Date(), -30),
        priceAtBooking: 75,
      },
    });
    const ok = await request(app)
      .patch(`/api/appointments/${past.id}/status`)
      .set(bearer(admin.accessToken))
      .send({ status: 'NO_SHOW' });
    expect(ok.status).toBe(200);
    expect(ok.body.appointment.status).toBe('NO_SHOW');

    const invalid = await request(app)
      .patch(`/api/appointments/${past.id}/status`)
      .set(bearer(admin.accessToken))
      .send({ status: 'CANCELLED' });
    expect(invalid.status).toBe(400);
  });
});
