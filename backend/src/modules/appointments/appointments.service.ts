import { addDays, addMinutes } from 'date-fns';
import { prisma } from '../../config/prisma.ts';
import type { Prisma } from '../../generated/prisma/client.ts';
import type { AppointmentStatus, Role } from '../../generated/prisma/enums.ts';
import { AppError } from '../../utils/errors.ts';
import { paginate, type Paginated } from '../../utils/pagination.ts';
import { decimalToNumber } from '../../utils/serializers.ts';
import { overlaps } from '../../utils/time.ts';
import {
  computeAvailability,
  localDateTime,
  localDayOfWeek,
} from '../availability/availability.core.ts';
import { loadStaffAvailabilityData } from '../availability/availability.service.ts';
import { getSettings } from '../settings/settings.service.ts';
import type {
  AdminListQuery,
  CreateAppointmentInput,
  UpdateStatusInput,
} from './appointments.schemas.ts';

export const MAX_FUTURE_APPOINTMENTS = 5;

const include = {
  service: { select: { id: true, name: true, durationMinutes: true } },
  staff: { select: { id: true, name: true } },
  client: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentRecord = Prisma.AppointmentGetPayload<{ include: typeof include }>;

export interface PublicAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  priceAtBooking: number;
  notes: string | null;
  service: { id: string; name: string; durationMinutes: number };
  staff: { id: string; name: string };
  client: { id: string; name: string; email: string; phone: string | null };
  cancelledAt: Date | null;
  cancelledBy: Role | null;
  createdAt: Date;
}

export function toPublicAppointment(appointment: AppointmentRecord): PublicAppointment {
  return {
    id: appointment.id,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    priceAtBooking: decimalToNumber(appointment.priceAtBooking),
    notes: appointment.notes,
    service: appointment.service,
    staff: appointment.staff,
    client: appointment.client,
    cancelledAt: appointment.cancelledAt,
    cancelledBy: appointment.cancelledBy,
    createdAt: appointment.createdAt,
  };
}

function isExclusionViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('no_overlapping_appointments') || message.includes('23P01');
}

/** Fecha local YYYY-MM-DD de un instante en la zona del negocio. */
function localDateString(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export async function createAppointment(
  clientId: string,
  input: CreateAppointmentInput,
): Promise<PublicAppointment> {
  const settings = await getSettings();
  const startsAt = new Date(input.startsAt);
  const now = new Date();

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service?.active) throw AppError.businessRule('El servicio no está disponible');

  const staff = await prisma.staff.findFirst({
    where: { id: input.staffId, active: true, services: { some: { serviceId: service.id } } },
  });
  if (!staff) throw AppError.businessRule('El profesional no ofrece ese servicio');

  const endsAt = addMinutes(startsAt, service.durationMinutes);

  // Reglas de anticipación
  if (startsAt < addMinutes(now, settings.minAdvanceHours * 60)) {
    throw AppError.businessRule(
      `Debes reservar con al menos ${settings.minAdvanceHours} horas de anticipación`,
    );
  }
  if (startsAt > addDays(now, settings.maxAdvanceDays)) {
    throw AppError.businessRule(
      `Solo se puede reservar con hasta ${settings.maxAdvanceDays} días de anticipación`,
    );
  }

  const date = localDateString(startsAt, settings.timezone);
  const [staffData] = await loadStaffAvailabilityData({
    serviceId: service.id,
    staffId: staff.id,
    date,
    timezone: settings.timezone,
  });
  if (!staffData) throw AppError.businessRule('El profesional no ofrece ese servicio');

  // Horario laboral: la cita debe caber completa en un bloque de ese día de la semana
  const dayOfWeek = localDayOfWeek(date, settings.timezone);
  const withinHours = staffData.workingHours.some((block) => {
    if (block.dayOfWeek !== dayOfWeek) return false;
    const blockStart = localDateTime(date, block.startTime, settings.timezone);
    const blockEnd = localDateTime(date, block.endTime, settings.timezone);
    return blockStart <= startsAt && endsAt <= blockEnd;
  });
  if (!withinHours) {
    throw AppError.businessRule('El horario está fuera de la jornada del profesional');
  }

  if (staffData.timeOff.some((interval) => overlaps({ startsAt, endsAt }, interval))) {
    throw AppError.businessRule('El profesional no está disponible ese día');
  }

  if (staffData.appointments.some((interval) => overlaps({ startsAt, endsAt }, interval))) {
    throw AppError.conflict('Ese horario ya está reservado, elige otro');
  }

  // El inicio debe ser uno de los horarios ofrecidos (alineado al intervalo)
  const slots = computeAvailability({
    date,
    timezone: settings.timezone,
    now,
    durationMinutes: service.durationMinutes,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    minAdvanceHours: settings.minAdvanceHours,
    maxAdvanceDays: settings.maxAdvanceDays,
    staff: [staffData],
  });
  if (!slots.some((slot) => slot.startsAt === startsAt.toISOString())) {
    throw AppError.businessRule('Ese horario no está disponible');
  }

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      // Bloqueo por cliente: dos reservas simultáneas del mismo cliente se serializan aquí,
      // así el límite de citas futuras no se puede superar con peticiones en paralelo
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${clientId} FOR UPDATE`;

      const futureCount = await tx.appointment.count({
        where: { clientId, status: 'CONFIRMED', startsAt: { gte: now } },
      });
      if (futureCount >= MAX_FUTURE_APPOINTMENTS) {
        throw AppError.businessRule(
          `Solo puedes tener ${MAX_FUTURE_APPOINTMENTS} citas futuras a la vez`,
        );
      }

      return tx.appointment.create({
        data: {
          clientId,
          staffId: staff.id,
          serviceId: service.id,
          startsAt,
          endsAt,
          priceAtBooking: service.price,
          notes: input.notes ?? null,
        },
        include,
      });
    });
    return toPublicAppointment(appointment);
  } catch (error) {
    // La restricción de exclusión de PostgreSQL es la última barrera ante peticiones simultáneas
    if (isExclusionViolation(error)) {
      throw AppError.conflict('Ese horario acaba de ser reservado, elige otro');
    }
    throw error;
  }
}

export async function listMine(
  clientId: string,
  scope: 'upcoming' | 'past',
): Promise<PublicAppointment[]> {
  const now = new Date();
  const appointments = await prisma.appointment.findMany({
    where:
      scope === 'upcoming'
        ? { clientId, status: 'CONFIRMED', startsAt: { gte: now } }
        : { clientId, OR: [{ status: { not: 'CONFIRMED' } }, { startsAt: { lt: now } }] },
    include,
    orderBy: { startsAt: scope === 'upcoming' ? 'asc' : 'desc' },
    take: 100,
  });
  return appointments.map(toPublicAppointment);
}

export async function cancelAppointment(
  id: string,
  actor: { id: string; role: Role },
): Promise<PublicAppointment> {
  const appointment = await prisma.appointment.findUnique({ where: { id }, include });
  if (!appointment) throw AppError.notFound('La cita no existe');

  const isAdmin = actor.role === 'ADMIN';
  if (!isAdmin && appointment.clientId !== actor.id) throw AppError.notFound('La cita no existe');
  if (appointment.status !== 'CONFIRMED') {
    throw AppError.businessRule('Solo se pueden cancelar citas confirmadas');
  }

  if (!isAdmin) {
    const { cancellationHours } = await getSettings();
    const limit = addMinutes(new Date(), cancellationHours * 60);
    if (appointment.startsAt < limit) {
      throw AppError.businessRule(
        `Solo puedes cancelar con al menos ${cancellationHours} horas de anticipación`,
      );
    }
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: actor.role },
    include,
  });
  return toPublicAppointment(updated);
}

export async function updateStatus(
  id: string,
  input: UpdateStatusInput,
): Promise<PublicAppointment> {
  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) throw AppError.notFound('La cita no existe');
  if (appointment.status !== 'CONFIRMED') {
    throw AppError.businessRule('Solo se puede cambiar el estado de citas confirmadas');
  }
  if (appointment.startsAt > new Date()) {
    throw AppError.businessRule('La cita aún no ha empezado');
  }
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: input.status },
    include,
  });
  return toPublicAppointment(updated);
}

export async function listForAdmin(query: AdminListQuery): Promise<Paginated<PublicAppointment>> {
  const { timezone } = await getSettings();
  const where: Prisma.AppointmentWhereInput = {
    ...(query.staffId && { staffId: query.staffId }),
    ...(query.status && { status: query.status }),
    ...((query.from || query.to) && {
      startsAt: {
        ...(query.from && { gte: localDateTime(query.from, '00:00', timezone) }),
        ...(query.to && { lt: addDays(localDateTime(query.to, '00:00', timezone), 1) }),
      },
    }),
  };
  const [total, appointments] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      include,
      orderBy: { startsAt: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return paginate(appointments.map(toPublicAppointment), total, query);
}
