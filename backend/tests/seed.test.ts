import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.ts';
import { runSeed } from '../src/db/seed-data.ts';
import { resetDatabase } from './helpers.ts';

beforeAll(async () => {
  await resetDatabase();
  await runSeed();
}, 60_000);

afterAll(async () => {
  await resetDatabase();
  await prisma.$disconnect();
});

describe('seed', () => {
  it('crea el negocio, usuarios, servicios, profesionales y citas', async () => {
    expect(await prisma.businessSettings.findUnique({ where: { id: 1 } })).toMatchObject({
      businessName: 'Barbería El Centro',
      timezone: 'America/Guatemala',
    });
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
    expect(await prisma.user.count({ where: { role: 'CLIENT' } })).toBe(6);
    expect(await prisma.service.count()).toBe(5);
    expect(await prisma.staff.count()).toBe(3);
    expect(await prisma.workingHours.count()).toBeGreaterThan(0);
    expect(await prisma.timeOff.count()).toBe(1);

    const total = await prisma.appointment.count();
    expect(total).toBeGreaterThanOrEqual(50);
    expect(total).toBeLessThanOrEqual(90);
    const future = await prisma.appointment.count({ where: { startsAt: { gt: new Date() } } });
    expect(future).toBeGreaterThanOrEqual(8);
    expect(await prisma.appointment.count({ where: { status: 'COMPLETED' } })).toBeGreaterThan(0);
    expect(await prisma.appointment.count({ where: { status: 'NO_SHOW' } })).toBeGreaterThan(0);
    expect(await prisma.appointment.count({ where: { status: 'CANCELLED' } })).toBeGreaterThan(0);
  });

  it('el cliente demo puede seguir reservando (máximo 2 citas futuras)', async () => {
    const demo = await prisma.user.findUniqueOrThrow({
      where: { email: 'cliente@reservaya.demo' },
    });
    const future = await prisma.appointment.count({
      where: { clientId: demo.id, status: 'CONFIRMED', startsAt: { gt: new Date() } },
    });
    expect(future).toBeLessThanOrEqual(2);
  });

  it('ninguna cita activa se traslapa con otra del mismo profesional', async () => {
    const overlapping = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM "Appointment" a
      JOIN "Appointment" b ON a."staffId" = b."staffId" AND a.id < b.id
      WHERE a.status IN ('CONFIRMED', 'COMPLETED') AND b.status IN ('CONFIRMED', 'COMPLETED')
        AND a."startsAt" < b."endsAt" AND b."startsAt" < a."endsAt"`;
    expect(Number(overlapping[0]!.count)).toBe(0);
  });

  it('se puede ejecutar varias veces sin duplicar datos', async () => {
    const before = await prisma.appointment.count();
    await runSeed();
    expect(await prisma.user.count()).toBe(7);
    expect(await prisma.service.count()).toBe(5);
    expect(await prisma.appointment.count()).toBe(before);
  }, 60_000);
});
