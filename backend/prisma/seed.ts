import bcrypt from 'bcrypt';
import { TZDate } from '@date-fns/tz';
import { addDays, addMinutes, startOfDay, subDays } from 'date-fns';
import { prisma } from '../src/config/prisma.ts';
import { logger } from '../src/config/logger.ts';
import type { AppointmentStatus, Role } from '../src/generated/prisma/enums.ts';

const TIMEZONE = 'America/Guatemala';
const BCRYPT_COST = 12;

// Generador pseudoaleatorio con semilla fija: el seed produce siempre los mismos datos
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = createRandom(20261103);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
const randomInt = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

interface WorkingBlock {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface StaffSeed {
  name: string;
  bio: string;
  serviceNames: string[];
  workingHours: WorkingBlock[];
}

const SERVICES = [
  {
    name: 'Corte clásico',
    description: 'Corte a tijera o máquina con acabado a navaja.',
    durationMinutes: 30,
    price: 75,
  },
  {
    name: 'Corte + barba',
    description: 'Corte completo y perfilado de barba.',
    durationMinutes: 45,
    price: 110,
  },
  {
    name: 'Afeitado con toalla caliente',
    description: 'Afeitado tradicional con navaja y toalla caliente.',
    durationMinutes: 30,
    price: 60,
  },
  {
    name: 'Diseño de barba',
    description: 'Perfilado y arreglo de barba.',
    durationMinutes: 15,
    price: 40,
  },
  {
    name: 'Tratamiento capilar',
    description: 'Lavado, mascarilla y masaje capilar.',
    durationMinutes: 60,
    price: 150,
  },
] as const;

const weekdays = (days: number[], blocks: Omit<WorkingBlock, 'dayOfWeek'>[]) =>
  days.flatMap((dayOfWeek) => blocks.map((block) => ({ dayOfWeek, ...block })));

const STAFF: StaffSeed[] = [
  {
    name: 'Carlos Méndez',
    bio: 'Barbero con 12 años de experiencia, especialista en cortes clásicos.',
    serviceNames: [
      'Corte clásico',
      'Corte + barba',
      'Afeitado con toalla caliente',
      'Diseño de barba',
    ],
    // Lunes a viernes 9-18 con almuerzo 13-14
    workingHours: weekdays(
      [1, 2, 3, 4, 5],
      [
        { startTime: '09:00', endTime: '13:00' },
        { startTime: '14:00', endTime: '18:00' },
      ],
    ),
  },
  {
    name: 'Luis Pérez',
    bio: 'Estilista moderno, fades y diseños.',
    serviceNames: ['Corte clásico', 'Corte + barba', 'Diseño de barba', 'Tratamiento capilar'],
    // Martes a sábado 10-19
    workingHours: weekdays([2, 3, 4, 5, 6], [{ startTime: '10:00', endTime: '19:00' }]),
  },
  {
    name: 'Diego Ramírez',
    bio: 'Afeitado tradicional y tratamientos.',
    serviceNames: ['Corte clásico', 'Afeitado con toalla caliente', 'Tratamiento capilar'],
    // Solo fines de semana 9-17
    workingHours: weekdays([0, 6], [{ startTime: '09:00', endTime: '17:00' }]),
  },
];

const CLIENTS = [
  {
    name: 'Cliente Demo',
    email: 'cliente@reservaya.demo',
    phone: '+502 5555 0100',
    password: 'Cliente1234',
  },
  {
    name: 'María López',
    email: 'maria.lopez@example.com',
    phone: '+502 5555 0101',
    password: 'Cliente1234',
  },
  {
    name: 'José García',
    email: 'jose.garcia@example.com',
    phone: '+502 5555 0102',
    password: 'Cliente1234',
  },
  {
    name: 'Ana Morales',
    email: 'ana.morales@example.com',
    phone: '+502 5555 0103',
    password: 'Cliente1234',
  },
  {
    name: 'Pedro Castillo',
    email: 'pedro.castillo@example.com',
    phone: null,
    password: 'Cliente1234',
  },
  {
    name: 'Lucía Hernández',
    email: 'lucia.hernandez@example.com',
    phone: '+502 5555 0105',
    password: 'Cliente1234',
  },
];

const NOTES = [
  null,
  null,
  null,
  'Prefiero el corte no muy corto a los lados.',
  'Llego unos minutos tarde, gracias por la paciencia.',
  'Primera vez, recomiéndenme algo.',
];

/** Instante UTC para una fecha (día local) y hora "HH:mm" en la zona del negocio. */
function localTime(day: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const tz = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes, TIMEZONE);
  return new Date(tz.getTime());
}

/** Día local (en la zona del negocio) desplazado N días respecto a hoy. */
function localDay(offsetDays: number): Date {
  const today = startOfDay(TZDate.tz(TIMEZONE));
  return offsetDays >= 0 ? addDays(today, offsetDays) : subDays(today, -offsetDays);
}

interface Interval {
  startsAt: Date;
  endsAt: Date;
}
const overlaps = (a: Interval, b: Interval) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;

async function clean() {
  await prisma.appointment.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.staffService.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
  await prisma.businessSettings.deleteMany();
}

async function main() {
  logger.info('Limpiando datos anteriores...');
  await clean();

  await prisma.businessSettings.create({
    data: {
      id: 1,
      businessName: 'Barbería El Centro',
      timezone: TIMEZONE,
      slotIntervalMinutes: 15,
      minAdvanceHours: 2,
      maxAdvanceDays: 30,
      cancellationHours: 12,
      contactPhone: '+502 2234 5678',
      address: '6a Avenida 12-34, Zona 1, Ciudad de Guatemala',
      description:
        'Barbería tradicional en el corazón de la ciudad. Cortes clásicos, barba y afeitado con navaja desde 2012.',
    },
  });

  logger.info('Creando usuarios...');
  const adminHash = await bcrypt.hash('Admin1234', BCRYPT_COST);
  const clientHash = await bcrypt.hash('Cliente1234', BCRYPT_COST);
  await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@reservaya.demo',
      phone: '+502 2234 5678',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  });
  const clients = [];
  for (const client of CLIENTS) {
    clients.push(
      await prisma.user.create({
        data: {
          name: client.name,
          email: client.email,
          phone: client.phone,
          passwordHash: clientHash,
        },
      }),
    );
  }
  const demoClient = clients[0]!;

  logger.info('Creando servicios y profesionales...');
  const services = new Map<string, { id: string; durationMinutes: number; price: number }>();
  for (const service of SERVICES) {
    const created = await prisma.service.create({ data: service });
    services.set(service.name, {
      id: created.id,
      durationMinutes: service.durationMinutes,
      price: service.price,
    });
  }

  const staffList = [];
  for (const staff of STAFF) {
    const created = await prisma.staff.create({
      data: {
        name: staff.name,
        bio: staff.bio,
        services: {
          create: staff.serviceNames.map((name) => ({ serviceId: services.get(name)!.id })),
        },
        workingHours: { create: staff.workingHours },
      },
    });
    staffList.push({ ...created, seed: staff });
  }

  // Día libre para Carlos el miércoles de la próxima semana
  const carlos = staffList[0]!;
  const nextWeekWednesday = (() => {
    let day = localDay(7);
    while (day.getDay() !== 3) day = addDays(day, 1);
    return day;
  })();
  await prisma.timeOff.create({
    data: {
      staffId: carlos.id,
      startsAt: localTime(nextWeekWednesday, '00:00'),
      endsAt: localTime(addDays(nextWeekWednesday, 1), '00:00'),
      reason: 'Cita médica',
    },
  });

  logger.info('Generando citas...');
  const occupied = new Map<string, Interval[]>();
  const futureCount = new Map<string, number>();
  let created = 0;

  const createAppointment = async (
    staff: (typeof staffList)[number],
    day: Date,
    status: AppointmentStatus,
    client: { id: string },
  ): Promise<boolean> => {
    const block = pick(staff.seed.workingHours.filter((b) => b.dayOfWeek === day.getDay()));
    const serviceName = pick(staff.seed.serviceNames);
    const service = services.get(serviceName)!;
    const blockStart = localTime(day, block.startTime);
    const blockEnd = localTime(day, block.endTime);
    const slotCount = Math.floor(
      ((blockEnd.getTime() - blockStart.getTime()) / 60_000 - service.durationMinutes) / 15,
    );
    if (slotCount < 0) return false;

    const startsAt = addMinutes(blockStart, randomInt(0, slotCount) * 15);
    const interval = { startsAt, endsAt: addMinutes(startsAt, service.durationMinutes) };
    const taken = occupied.get(staff.id) ?? [];
    // Las canceladas no bloquean, pero evitamos traslapes también entre ellas para un seed limpio
    if (taken.some((t) => overlaps(t, interval))) return false;
    taken.push(interval);
    occupied.set(staff.id, taken);

    await prisma.appointment.create({
      data: {
        clientId: client.id,
        staffId: staff.id,
        serviceId: service.id,
        startsAt: interval.startsAt,
        endsAt: interval.endsAt,
        status,
        priceAtBooking: service.price,
        notes: pick(NOTES),
        createdAt: subDays(startsAt, randomInt(1, 6)),
        ...(status === 'CANCELLED' && {
          cancelledAt: subDays(startsAt, 1),
          cancelledBy: (random() < 0.8 ? 'CLIENT' : 'ADMIN') as Role,
        }),
      },
    });
    created += 1;
    return true;
  };

  // ~60 citas en las últimas 4 semanas
  const PAST_STATUSES: AppointmentStatus[] = [
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'NO_SHOW',
    'CANCELLED',
  ];
  for (let offset = -28; offset <= -1 && created < 60; offset++) {
    const day = localDay(offset);
    for (const staff of staffList) {
      if (!staff.seed.workingHours.some((b) => b.dayOfWeek === day.getDay())) continue;
      const count = randomInt(0, 2);
      for (let i = 0; i < count && created < 60; i++) {
        await createAppointment(staff, day, pick(PAST_STATUSES), pick(clients));
      }
    }
  }
  const pastCreated = created;

  // ~15 citas confirmadas en las próximas 2 semanas (desde mañana)
  const MAX_FUTURE_PER_CLIENT = 5;
  const MAX_FUTURE_DEMO_CLIENT = 2;
  for (let offset = 1; offset <= 14 && created - pastCreated < 15; offset++) {
    const day = localDay(offset);
    for (const staff of staffList) {
      if (created - pastCreated >= 15) break;
      if (!staff.seed.workingHours.some((b) => b.dayOfWeek === day.getDay())) continue;
      if (staff.id === carlos.id && day.getTime() === nextWeekWednesday.getTime()) continue;
      if (random() > 0.55) continue;

      const client = pick(clients);
      const limit = client.id === demoClient.id ? MAX_FUTURE_DEMO_CLIENT : MAX_FUTURE_PER_CLIENT;
      if ((futureCount.get(client.id) ?? 0) >= limit) continue;

      if (await createAppointment(staff, day, 'CONFIRMED', client)) {
        futureCount.set(client.id, (futureCount.get(client.id) ?? 0) + 1);
      }
    }
  }

  const byStatus = await prisma.appointment.groupBy({ by: ['status'], _count: { _all: true } });
  logger.info(
    { citas: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])) },
    `Seed completado: ${created} citas (${pastCreated} pasadas, ${created - pastCreated} futuras)`,
  );
  logger.info(
    'Credenciales: admin@reservaya.demo / Admin1234 · cliente@reservaya.demo / Cliente1234',
  );
}

main()
  .catch((err) => {
    logger.error({ err }, 'El seed falló');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
