import { TZDate } from '@date-fns/tz';
import { prisma } from '../../config/prisma.ts';
import type { Staff, TimeOff, WorkingHours } from '../../generated/prisma/client.ts';
import { AppError } from '../../utils/errors.ts';
import { decimalToNumber } from '../../utils/serializers.ts';
import { overlaps, timeToMinutes } from '../../utils/time.ts';
import { getSettings } from '../settings/settings.service.ts';
import type {
  CreateStaffInput,
  CreateTimeOffInput,
  PutWorkingHoursInput,
  UpdateStaffInput,
} from './staff.schemas.ts';

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export interface PublicStaff {
  id: string;
  name: string;
  bio: string | null;
  active: boolean;
  services: { id: string; name: string; durationMinutes: number; price: number; active: boolean }[];
}

/** Cita afectada por un cambio de horario o día libre; el admin decide qué hacer con ella. */
export interface AffectedAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  clientName: string;
  serviceName: string;
}

type StaffWithServices = Staff & {
  services: {
    service: { id: string; name: string; durationMinutes: number; price: unknown; active: boolean };
  }[];
};

const includeServices = {
  services: {
    include: {
      service: {
        select: { id: true, name: true, durationMinutes: true, price: true, active: true },
      },
    },
  },
} as const;

function toPublicStaff(staff: StaffWithServices): PublicStaff {
  return {
    id: staff.id,
    name: staff.name,
    bio: staff.bio,
    active: staff.active,
    services: staff.services.map(({ service }) => ({
      ...service,
      price: decimalToNumber(service.price as number),
    })),
  };
}

export async function listStaff(options: {
  serviceId?: string;
  includeInactive: boolean;
}): Promise<PublicStaff[]> {
  const staff = await prisma.staff.findMany({
    where: {
      ...(options.includeInactive ? {} : { active: true }),
      ...(options.serviceId && { services: { some: { serviceId: options.serviceId } } }),
    },
    include: includeServices,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });
  return staff.map(toPublicStaff);
}

export async function getStaff(id: string): Promise<PublicStaff> {
  const staff = await prisma.staff.findUnique({ where: { id }, include: includeServices });
  if (!staff) throw AppError.notFound('El profesional no existe');
  return toPublicStaff(staff);
}

async function assertServicesExist(serviceIds: string[]) {
  if (serviceIds.length === 0) return;
  const count = await prisma.service.count({ where: { id: { in: serviceIds } } });
  if (count !== new Set(serviceIds).size) {
    throw AppError.validation('Datos inválidos', { serviceIds: 'Algún servicio no existe' });
  }
}

export async function createStaff(input: CreateStaffInput): Promise<PublicStaff> {
  const serviceIds = [...new Set(input.serviceIds ?? [])];
  await assertServicesExist(serviceIds);
  const staff = await prisma.staff.create({
    data: {
      name: input.name,
      bio: input.bio ?? null,
      services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
    },
    include: includeServices,
  });
  return toPublicStaff(staff);
}

export async function updateStaff(id: string, input: UpdateStaffInput): Promise<PublicStaff> {
  await getStaff(id);
  const { serviceIds, ...data } = input;
  const uniqueIds = serviceIds ? [...new Set(serviceIds)] : undefined;
  if (uniqueIds) await assertServicesExist(uniqueIds);

  const staff = await prisma.$transaction(async (tx) => {
    if (uniqueIds) {
      await tx.staffService.deleteMany({ where: { staffId: id } });
      await tx.staffService.createMany({
        data: uniqueIds.map((serviceId) => ({ staffId: id, serviceId })),
      });
    }
    return tx.staff.update({ where: { id }, data, include: includeServices });
  });
  return toPublicStaff(staff);
}

export async function toggleStaff(
  id: string,
): Promise<{ staff: PublicStaff; affectedAppointments: AffectedAppointment[] }> {
  const current = await prisma.staff.findUnique({ where: { id } });
  if (!current) throw AppError.notFound('El profesional no existe');
  const staff = await prisma.staff.update({
    where: { id },
    data: { active: !current.active },
    include: includeServices,
  });
  // Al desactivar, avisar de las citas futuras que siguen confirmadas
  const affectedAppointments = staff.active
    ? []
    : await findAffectedAppointments(id, { startsAt: new Date(), endsAt: new Date(8.64e15) });
  return { staff: toPublicStaff(staff), affectedAppointments };
}

// ---------- Horario semanal ----------

export async function getWorkingHours(staffId: string): Promise<WorkingHours[]> {
  await getStaff(staffId);
  return prisma.workingHours.findMany({
    where: { staffId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}

function assertBlocksDoNotOverlap(blocks: PutWorkingHoursInput['blocks']) {
  const byDay = new Map<number, { start: number; end: number }[]>();
  for (const block of blocks) {
    const list = byDay.get(block.dayOfWeek) ?? [];
    list.push({ start: timeToMinutes(block.startTime), end: timeToMinutes(block.endTime) });
    byDay.set(block.dayOfWeek, list);
  }
  for (const [day, list] of byDay) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      if (list[i]!.start < list[i - 1]!.end) {
        throw AppError.validation('Horario inválido', {
          blocks: `Los bloques del ${DAY_NAMES[day]} se traslapan`,
        });
      }
    }
  }
}

/** Reemplaza todos los bloques. Devuelve las citas futuras que quedan fuera del nuevo horario. */
export async function replaceWorkingHours(
  staffId: string,
  input: PutWorkingHoursInput,
): Promise<{ workingHours: WorkingHours[]; affectedAppointments: AffectedAppointment[] }> {
  await getStaff(staffId);
  assertBlocksDoNotOverlap(input.blocks);

  const workingHours = await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { staffId } });
    await tx.workingHours.createMany({
      data: input.blocks.map((block) => ({ staffId, ...block })),
    });
    return tx.workingHours.findMany({
      where: { staffId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  });

  const { timezone } = await getSettings();
  const future = await prisma.appointment.findMany({
    where: { staffId, status: 'CONFIRMED', startsAt: { gte: new Date() } },
    include: { client: { select: { name: true } }, service: { select: { name: true } } },
  });
  const affectedAppointments = future
    .filter((appointment) => !fitsInWorkingHours(appointment, workingHours, timezone))
    .map(toAffected);

  return { workingHours, affectedAppointments };
}

function fitsInWorkingHours(
  appointment: { startsAt: Date; endsAt: Date },
  blocks: WorkingHours[],
  timezone: string,
): boolean {
  const start = new TZDate(appointment.startsAt, timezone);
  const end = new TZDate(appointment.endsAt, timezone);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const sameDay = start.getDate() === end.getDate();
  return blocks.some(
    (block) =>
      block.dayOfWeek === start.getDay() &&
      sameDay &&
      timeToMinutes(block.startTime) <= startMinutes &&
      endMinutes <= timeToMinutes(block.endTime),
  );
}

// ---------- Días libres ----------

export async function listTimeOff(staffId: string): Promise<TimeOff[]> {
  await getStaff(staffId);
  return prisma.timeOff.findMany({ where: { staffId }, orderBy: { startsAt: 'asc' } });
}

export async function createTimeOff(
  staffId: string,
  input: CreateTimeOffInput,
): Promise<{ timeOff: TimeOff; affectedAppointments: AffectedAppointment[] }> {
  await getStaff(staffId);
  const timeOff = await prisma.timeOff.create({
    data: { staffId, startsAt: input.startsAt, endsAt: input.endsAt, reason: input.reason ?? null },
  });
  const affectedAppointments = await findAffectedAppointments(staffId, timeOff);
  return { timeOff, affectedAppointments };
}

export async function deleteTimeOff(id: string): Promise<void> {
  const existing = await prisma.timeOff.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('El día libre no existe');
  await prisma.timeOff.delete({ where: { id } });
}

async function findAffectedAppointments(
  staffId: string,
  interval: { startsAt: Date; endsAt: Date },
): Promise<AffectedAppointment[]> {
  const appointments = await prisma.appointment.findMany({
    where: {
      staffId,
      status: 'CONFIRMED',
      startsAt: { lt: interval.endsAt },
      endsAt: { gt: interval.startsAt },
    },
    include: { client: { select: { name: true } }, service: { select: { name: true } } },
    orderBy: { startsAt: 'asc' },
  });
  return appointments.filter((a) => overlaps(a, interval)).map(toAffected);
}

function toAffected(appointment: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  client: { name: string };
  service: { name: string };
}): AffectedAppointment {
  return {
    id: appointment.id,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    clientName: appointment.client.name,
    serviceName: appointment.service.name,
  };
}
