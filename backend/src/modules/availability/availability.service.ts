import { addDays } from 'date-fns';
import { prisma } from '../../config/prisma.ts';
import { AppError } from '../../utils/errors.ts';
import { getSettings } from '../settings/settings.service.ts';
import {
  computeAvailability,
  localDateTime,
  type Slot,
  type StaffAvailabilityData,
} from './availability.core.ts';

export interface AvailabilityResult {
  date: string;
  timezone: string;
  slots: Slot[];
}

/** Carga desde la base de datos lo que necesita el cálculo de un día y un servicio. */
export async function loadStaffAvailabilityData(options: {
  serviceId: string;
  staffId?: string;
  date: string;
  timezone: string;
}): Promise<StaffAvailabilityData[]> {
  // Margen de un día a cada lado para cubrir citas y días libres que cruzan la medianoche
  const dayStart = localDateTime(options.date, '00:00', options.timezone);
  const windowStart = addDays(dayStart, -1);
  const windowEnd = addDays(dayStart, 2);

  const staff = await prisma.staff.findMany({
    where: {
      active: true,
      ...(options.staffId && { id: options.staffId }),
      services: { some: { serviceId: options.serviceId, service: { active: true } } },
    },
    include: {
      workingHours: true,
      timeOff: { where: { startsAt: { lt: windowEnd }, endsAt: { gt: windowStart } } },
      appointments: {
        where: {
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          startsAt: { lt: windowEnd },
          endsAt: { gt: windowStart },
        },
        select: { startsAt: true, endsAt: true, status: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return staff.map((member) => ({
    id: member.id,
    name: member.name,
    workingHours: member.workingHours,
    timeOff: member.timeOff,
    appointments: member.appointments,
  }));
}

export async function getAvailability(options: {
  serviceId: string;
  staffId?: string;
  date: string;
  now?: Date;
}): Promise<AvailabilityResult> {
  const [settings, service] = await Promise.all([
    getSettings(),
    prisma.service.findUnique({ where: { id: options.serviceId } }),
  ]);
  if (!service || !service.active) throw AppError.notFound('El servicio no existe');

  const staff = await loadStaffAvailabilityData({ ...options, timezone: settings.timezone });

  const slots = computeAvailability({
    date: options.date,
    timezone: settings.timezone,
    now: options.now ?? new Date(),
    durationMinutes: service.durationMinutes,
    slotIntervalMinutes: settings.slotIntervalMinutes,
    minAdvanceHours: settings.minAdvanceHours,
    maxAdvanceDays: settings.maxAdvanceDays,
    staff,
  });

  return { date: options.date, timezone: settings.timezone, slots };
}
