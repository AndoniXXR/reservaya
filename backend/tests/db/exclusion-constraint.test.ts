import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/config/prisma.ts';

// Verifica la restricción de exclusión de PostgreSQL: dos citas activas del mismo
// profesional no pueden traslaparse, aunque el código no lo valide.
describe('restricción no_overlapping_appointments', () => {
  let clientId = '';
  let staffId = '';
  let serviceId = '';

  const base = new Date('2030-01-15T15:00:00.000Z');
  const minutes = (m: number) => new Date(base.getTime() + m * 60_000);

  beforeAll(async () => {
    const client = await prisma.user.create({
      data: { name: 'Test', email: `excl-${Date.now()}@test.dev`, passwordHash: 'x' },
    });
    const staff = await prisma.staff.create({ data: { name: 'Staff Test' } });
    const service = await prisma.service.create({
      data: { name: 'Servicio Test', durationMinutes: 45, price: 100 },
    });
    clientId = client.id;
    staffId = staff.id;
    serviceId = service.id;
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { staffId } });
    await prisma.staff.delete({ where: { id: staffId } });
    await prisma.service.delete({ where: { id: serviceId } });
    await prisma.user.delete({ where: { id: clientId } });
    await prisma.$disconnect();
  });

  const create = (startMin: number, endMin: number, status: 'CONFIRMED' | 'CANCELLED') =>
    prisma.appointment.create({
      data: {
        clientId,
        staffId,
        serviceId,
        startsAt: minutes(startMin),
        endsAt: minutes(endMin),
        status,
        priceAtBooking: 100,
      },
    });

  it('rechaza una cita que se traslapa con otra confirmada', async () => {
    await create(0, 45, 'CONFIRMED');
    await expect(create(30, 60, 'CONFIRMED')).rejects.toThrow(/no_overlapping_appointments|23P01/);
  });

  it('permite citas contiguas (el fin de una es el inicio de otra)', async () => {
    await expect(create(45, 90, 'CONFIRMED')).resolves.toBeDefined();
  });

  it('las citas canceladas no bloquean el horario', async () => {
    await expect(create(0, 45, 'CANCELLED')).resolves.toBeDefined();
  });
});
