import { addMinutes } from 'date-fns';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { prisma } from '../src/config/prisma.ts';
import { localDateTime } from '../src/modules/availability/availability.core.ts';
import { bearer, createAndLogin, resetDatabase } from './helpers.ts';

const app = createApp();
const TZ = 'America/Guatemala';
// Semana fija del pasado: lunes 2 a domingo 8 de marzo de 2026
const FROM = '2026-03-02';
const TO = '2026-03-08';

let admin = '';
let client = '';

beforeAll(async () => {
  await resetDatabase();
  admin = (await createAndLogin(app, { role: 'ADMIN' })).accessToken;
  const user = await createAndLogin(app);
  client = user.accessToken;

  const corte = await prisma.service.create({
    data: { name: 'Corte', durationMinutes: 30, price: 75 },
  });
  const barba = await prisma.service.create({
    data: { name: 'Barba', durationMinutes: 15, price: 40 },
  });
  // Carlos trabaja lunes y martes 4 h (09-13); Ana no tiene horario
  const carlos = await prisma.staff.create({
    data: {
      name: 'Carlos',
      workingHours: {
        create: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
        ],
      },
    },
  });
  const ana = await prisma.staff.create({ data: { name: 'Ana' } });

  const make = (
    staffId: string,
    serviceId: string,
    date: string,
    time: string,
    minutes: number,
    status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW',
    price: number,
  ) => {
    const startsAt = localDateTime(date, time, TZ);
    return prisma.appointment.create({
      data: {
        clientId: user.userId,
        staffId,
        serviceId,
        startsAt,
        endsAt: addMinutes(startsAt, minutes),
        status,
        priceAtBooking: price,
      },
    });
  };

  await make(carlos.id, corte.id, '2026-03-02', '09:00', 30, 'COMPLETED', 75);
  await make(carlos.id, corte.id, '2026-03-02', '10:00', 30, 'COMPLETED', 75);
  await make(carlos.id, barba.id, '2026-03-02', '11:00', 15, 'NO_SHOW', 40);
  await make(carlos.id, corte.id, '2026-03-03', '09:00', 30, 'CANCELLED', 75);
  await make(ana.id, corte.id, '2026-03-03', '09:00', 30, 'COMPLETED', 80);
  // Fuera del rango
  await make(carlos.id, corte.id, '2026-03-09', '09:00', 30, 'COMPLETED', 75);
});

afterAll(() => prisma.$disconnect());

describe('GET /api/stats/overview', () => {
  it('solo admin', async () => {
    const res = await request(app)
      .get(`/api/stats/overview?from=${FROM}&to=${TO}`)
      .set(bearer(client));
    expect(res.status).toBe(403);
  });

  it('valida el rango', async () => {
    const res = await request(app)
      .get('/api/stats/overview?from=2026-03-08&to=2026-03-02')
      .set(bearer(admin));
    expect(res.status).toBe(400);
  });

  it('calcula totales, ingresos, inasistencia, ocupación, citas por día y top servicios', async () => {
    const res = await request(app)
      .get(`/api/stats/overview?from=${FROM}&to=${TO}`)
      .set(bearer(admin));
    expect(res.status).toBe(200);
    const body = res.body;

    expect(body.totalsByStatus).toEqual({ CONFIRMED: 0, CANCELLED: 1, COMPLETED: 3, NO_SHOW: 1 });
    expect(body.revenue).toBe(230);
    expect(body.noShowRate).toBeCloseTo(0.25);

    // Carlos: 2 días × 240 min = 480 min laborables; reservados 30+30+15 = 75 (la cancelada no cuenta)
    const carlos = body.occupancyByStaff.find(
      (s: { staffName: string }) => s.staffName === 'Carlos',
    );
    expect(carlos).toMatchObject({ bookedMinutes: 75, workingMinutes: 480 });
    expect(carlos.rate).toBeCloseTo(75 / 480);
    const ana = body.occupancyByStaff.find((s: { staffName: string }) => s.staffName === 'Ana');
    expect(ana).toMatchObject({ bookedMinutes: 30, workingMinutes: 0, rate: 0 });

    expect(body.appointmentsPerDay).toHaveLength(7);
    expect(body.appointmentsPerDay[0]).toEqual({ date: '2026-03-02', count: 3 });
    expect(body.appointmentsPerDay[1]).toEqual({ date: '2026-03-03', count: 1 });
    expect(body.appointmentsPerDay[6]).toEqual({ date: '2026-03-08', count: 0 });

    expect(body.topServices[0]).toMatchObject({ serviceName: 'Corte', count: 3 });
    expect(body.topServices[1]).toMatchObject({ serviceName: 'Barba', count: 1 });

    expect(body.highlights).toMatchObject({ today: 0, thisWeek: 0, monthRevenue: 0 });
  });
});
