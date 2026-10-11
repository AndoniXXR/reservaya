import { addDays, addMinutes } from 'date-fns';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { env } from '../src/config/env.ts';
import { outbox } from '../src/config/mailer.ts';
import { prisma } from '../src/config/prisma.ts';
import { runReminderPass, tomorrowWindow } from '../src/jobs/reminders.job.ts';
import { localDateTime } from '../src/modules/availability/availability.core.ts';
import { createUser, resetDatabase } from './helpers.ts';

const app = createApp();
const TZ = 'America/Guatemala';
let clientId = '';
let staffId = '';
let serviceId = '';

beforeAll(async () => {
  await resetDatabase();
  clientId = (await createUser()).id;
  serviceId = (
    await prisma.service.create({ data: { name: 'Corte', durationMinutes: 30, price: 75 } })
  ).id;
  staffId = (await prisma.staff.create({ data: { name: 'Carlos' } })).id;
});

beforeEach(async () => {
  outbox.length = 0;
  await prisma.appointment.deleteMany();
});

afterAll(() => prisma.$disconnect());

const createAt = (startsAt: Date) =>
  prisma.appointment.create({
    data: {
      clientId,
      staffId,
      serviceId,
      startsAt,
      endsAt: addMinutes(startsAt, 30),
      priceAtBooking: 75,
    },
  });

describe('ventana diaria de recordatorios', () => {
  it('cubre exactamente el día local de mañana', async () => {
    // "Ahora": 2026-11-03 a las 09:00 de Guatemala
    const now = localDateTime('2026-11-03', '09:00', TZ);
    const window = await tomorrowWindow(now);
    expect(window.start.toISOString()).toBe(localDateTime('2026-11-04', '00:00', TZ).toISOString());
    expect(window.end.toISOString()).toBe(localDateTime('2026-11-05', '00:00', TZ).toISOString());
  });

  it('envía solo las citas de mañana', async () => {
    const now = localDateTime('2026-11-03', '09:00', TZ);
    await createAt(localDateTime('2026-11-04', '10:00', TZ)); // mañana → sí
    await createAt(localDateTime('2026-11-04', '18:30', TZ)); // mañana por la tarde → sí
    await createAt(localDateTime('2026-11-03', '15:00', TZ)); // hoy → no
    await createAt(localDateTime('2026-11-05', '09:00', TZ)); // pasado mañana → no
    expect(await runReminderPass(now, await tomorrowWindow(now))).toBe(2);
    expect(outbox).toHaveLength(2);
  });
});

describe('GET /api/jobs/*', () => {
  const secret = env.CRON_SECRET;

  it('sin CRON_SECRET configurado la ruta no existe (404)', async () => {
    if (secret) return;
    const res = await request(app).get('/api/jobs/reminders');
    expect(res.status).toBe(404);
  });

  it('con CRON_SECRET exige el bearer correcto', async () => {
    if (!secret) return;
    expect((await request(app).get('/api/jobs/reminders')).status).toBe(401);
    expect(
      (await request(app).get('/api/jobs/reminders').set('Authorization', 'Bearer incorrecto'))
        .status,
    ).toBe(401);
    await createAt(addDays(new Date(), 1));
    const ok = await request(app)
      .get('/api/jobs/reminders')
      .set('Authorization', `Bearer ${secret}`);
    expect(ok.status).toBe(200);
    expect(ok.body.sent).toBeGreaterThanOrEqual(0);
  });
});
