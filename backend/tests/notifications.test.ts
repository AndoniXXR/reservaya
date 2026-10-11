import { addDays, addHours, addMinutes } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.ts';
import { outbox } from '../src/config/mailer.ts';
import { prisma } from '../src/config/prisma.ts';
import { runReminderPass } from '../src/jobs/reminders.job.ts';
import { bearer, createAndLogin, resetDatabase } from './helpers.ts';

const app = createApp();
const TZ = 'America/Guatemala';

let client = { accessToken: '', userId: '' };
let admin = { accessToken: '', userId: '' };
let serviceId = '';
let staffId = '';

function upcoming(time: string, daysAhead = 2): Date {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const base = addDays(TZDate.tz(TZ), daysAhead);
  return new Date(
    new TZDate(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, TZ).getTime(),
  );
}

beforeAll(async () => {
  await resetDatabase();
  client = await createAndLogin(app, { name: 'Ana Cliente' });
  admin = await createAndLogin(app, { role: 'ADMIN' });
  const service = await prisma.service.create({
    data: { name: 'Corte', durationMinutes: 30, price: 75 },
  });
  serviceId = service.id;
  const staff = await prisma.staff.create({
    data: {
      name: 'Carlos',
      services: { create: [{ serviceId }] },
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
  outbox.length = 0;
  await prisma.appointment.deleteMany();
});

afterAll(() => prisma.$disconnect());

describe('correos de citas', () => {
  it('al reservar se encola un correo de confirmación', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set(bearer(client.accessToken))
      .send({ serviceId, staffId, startsAt: upcoming('10:00').toISOString() });
    expect(res.status).toBe(201);

    await vi.waitFor(() => expect(outbox).toHaveLength(1));
    const mail = outbox[0]!;
    expect(mail.subject).toContain('Cita confirmada');
    expect(mail.subject).toContain('Corte');
    expect(mail.html).toContain('Ana Cliente');
    expect(mail.html).toContain('Carlos');
    expect(mail.html).toContain('/mis-citas');
    expect(mail.text).toContain('Q 75.00');
  });

  it('al cancelar se avisa indicando si lo hizo el negocio', async () => {
    const created = await request(app)
      .post('/api/appointments')
      .set(bearer(client.accessToken))
      .send({ serviceId, staffId, startsAt: upcoming('11:00').toISOString() });
    await vi.waitFor(() => expect(outbox).toHaveLength(1));

    await request(app)
      .patch(`/api/appointments/${created.body.appointment.id}/cancel`)
      .set(bearer(admin.accessToken));
    await vi.waitFor(() => expect(outbox).toHaveLength(2));
    expect(outbox[1]!.subject).toContain('Cita cancelada');
    expect(outbox[1]!.text).toContain('ha cancelado tu cita');
  });
});

describe('job de recordatorios', () => {
  const createAt = (startsAt: Date, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') =>
    prisma.appointment.create({
      data: {
        clientId: client.userId,
        staffId,
        serviceId,
        startsAt,
        endsAt: addMinutes(startsAt, 30),
        status,
        priceAtBooking: 75,
      },
    });

  it('envía un recordatorio una sola vez a las citas de dentro de ~24 h', async () => {
    const now = new Date();
    const inWindow = await createAt(addHours(now, 24));
    await createAt(addHours(now, 30)); // fuera de la ventana
    await createAt(addHours(now, 24), 'CANCELLED'); // cancelada: no se avisa

    expect(await runReminderPass(now)).toBe(1);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]!.subject).toContain('Recordatorio');

    const updated = await prisma.appointment.findUniqueOrThrow({ where: { id: inWindow.id } });
    expect(updated.reminderSentAt).not.toBeNull();

    // Una segunda pasada no repite el envío
    expect(await runReminderPass(now)).toBe(0);
    expect(outbox).toHaveLength(1);
  });

  it('dos pasadas simultáneas no duplican recordatorios', async () => {
    const now = new Date();
    await createAt(addHours(now, 24));
    await createAt(addHours(now, 23.5));
    const [a, b] = await Promise.all([runReminderPass(now), runReminderPass(now)]);
    expect(a + b).toBe(2);
    expect(outbox).toHaveLength(2);
  });
});
