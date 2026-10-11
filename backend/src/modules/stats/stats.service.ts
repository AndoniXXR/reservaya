import { TZDate } from '@date-fns/tz';
import { addDays, differenceInCalendarDays, endOfMonth, startOfMonth, startOfWeek } from 'date-fns';
import { prisma } from '../../config/prisma.ts';
import type { AppointmentStatus } from '../../generated/prisma/enums.ts';
import { decimalToNumber } from '../../utils/serializers.ts';
import { timeToMinutes } from '../../utils/time.ts';
import { localDateTime, localDayOfWeek } from '../availability/availability.core.ts';
import { getSettings } from '../settings/settings.service.ts';
import type { OverviewQuery } from './stats.schemas.ts';

export interface StatsOverview {
  range: { from: string; to: string };
  totalsByStatus: Record<AppointmentStatus, number>;
  /** Suma de priceAtBooking de las citas COMPLETED del periodo */
  revenue: number;
  /** NO_SHOW / (COMPLETED + NO_SHOW); null si no hay citas pasadas */
  noShowRate: number | null;
  /** minutos reservados / minutos laborables del periodo, por profesional */
  occupancyByStaff: {
    staffId: string;
    staffName: string;
    bookedMinutes: number;
    workingMinutes: number;
    rate: number;
  }[];
  /** Citas por día local (sin contar canceladas) para la gráfica de líneas */
  appointmentsPerDay: { date: string; count: number }[];
  topServices: { serviceId: string; serviceName: string; count: number }[];
  /** Tarjetas del dashboard, independientes del rango */
  highlights: { today: number; thisWeek: number; monthRevenue: number };
}

const STATUSES: AppointmentStatus[] = ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'];
const BOOKED: AppointmentStatus[] = ['CONFIRMED', 'COMPLETED', 'NO_SHOW'];

function localDateString(instant: Date, timezone: string): string {
  const local = new TZDate(instant, timezone);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
}

export async function getOverview(query: OverviewQuery): Promise<StatsOverview> {
  const { timezone } = await getSettings();
  const rangeStart = localDateTime(query.from, '00:00', timezone);
  const rangeEnd = addDays(localDateTime(query.to, '00:00', timezone), 1);
  const inRange = { startsAt: { gte: rangeStart, lt: rangeEnd } };

  const [byStatus, revenue, appointments, staff, topServicesRaw] = await Promise.all([
    prisma.appointment.groupBy({ by: ['status'], where: inRange, _count: { _all: true } }),
    prisma.appointment.aggregate({
      where: { ...inRange, status: 'COMPLETED' },
      _sum: { priceAtBooking: true },
    }),
    prisma.appointment.findMany({
      where: { ...inRange, status: { in: BOOKED } },
      select: { staffId: true, startsAt: true, endsAt: true },
    }),
    prisma.staff.findMany({
      where: { active: true },
      include: { workingHours: true },
      orderBy: { name: 'asc' },
    }),
    prisma.appointment.groupBy({
      by: ['serviceId'],
      where: { ...inRange, status: { in: BOOKED } },
      _count: { _all: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
    }),
  ]);

  const totalsByStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
    AppointmentStatus,
    number
  >;
  for (const row of byStatus) totalsByStatus[row.status] = row._count._all;

  const finished = totalsByStatus.COMPLETED + totalsByStatus.NO_SHOW;
  const noShowRate = finished === 0 ? null : Number((totalsByStatus.NO_SHOW / finished).toFixed(4));

  // Minutos laborables: bloques de horario por cada día del rango que caiga en ese día de la semana
  const days = differenceInCalendarDays(rangeEnd, rangeStart);
  const weekdayCounts = new Map<number, number>();
  for (let i = 0; i < days; i++) {
    const day = localDayOfWeek(localDateString(addDays(rangeStart, i), timezone), timezone);
    weekdayCounts.set(day, (weekdayCounts.get(day) ?? 0) + 1);
  }
  const bookedByStaff = new Map<string, number>();
  for (const a of appointments) {
    const minutes = (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000;
    bookedByStaff.set(a.staffId, (bookedByStaff.get(a.staffId) ?? 0) + minutes);
  }
  const occupancyByStaff = staff.map((member) => {
    const workingMinutes = member.workingHours.reduce(
      (sum, block) =>
        sum +
        (weekdayCounts.get(block.dayOfWeek) ?? 0) *
          (timeToMinutes(block.endTime) - timeToMinutes(block.startTime)),
      0,
    );
    const bookedMinutes = bookedByStaff.get(member.id) ?? 0;
    return {
      staffId: member.id,
      staffName: member.name,
      bookedMinutes,
      workingMinutes,
      rate: workingMinutes === 0 ? 0 : Number((bookedMinutes / workingMinutes).toFixed(4)),
    };
  });

  const perDay = new Map<string, number>();
  for (let i = 0; i < days; i++) perDay.set(localDateString(addDays(rangeStart, i), timezone), 0);
  for (const a of appointments) {
    const key = localDateString(a.startsAt, timezone);
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const appointmentsPerDay = [...perDay].map(([date, count]) => ({ date, count }));

  const serviceNames = await prisma.service.findMany({
    where: { id: { in: topServicesRaw.map((row) => row.serviceId) } },
    select: { id: true, name: true },
  });
  const topServices = topServicesRaw.map((row) => ({
    serviceId: row.serviceId,
    serviceName: serviceNames.find((s) => s.id === row.serviceId)?.name ?? '',
    count: row._count._all,
  }));

  return {
    range: { from: query.from, to: query.to },
    totalsByStatus,
    revenue: decimalToNumber(revenue._sum.priceAtBooking ?? 0),
    noShowRate,
    occupancyByStaff,
    appointmentsPerDay,
    topServices,
    highlights: await getHighlights(timezone),
  };
}

async function getHighlights(timezone: string): Promise<StatsOverview['highlights']> {
  const nowLocal = TZDate.tz(timezone);
  const today = localDateString(nowLocal, timezone);
  const todayStart = localDateTime(today, '00:00', timezone);
  const weekStartLocal = startOfWeek(nowLocal, { weekStartsOn: 1 });
  const weekStart = localDateTime(localDateString(weekStartLocal, timezone), '00:00', timezone);
  const monthStart = localDateTime(
    localDateString(startOfMonth(nowLocal), timezone),
    '00:00',
    timezone,
  );
  const monthEnd = addDays(
    localDateTime(localDateString(endOfMonth(nowLocal), timezone), '00:00', timezone),
    1,
  );

  const [todayCount, weekCount, monthRevenue] = await Promise.all([
    prisma.appointment.count({
      where: { status: { in: BOOKED }, startsAt: { gte: todayStart, lt: addDays(todayStart, 1) } },
    }),
    prisma.appointment.count({
      where: { status: { in: BOOKED }, startsAt: { gte: weekStart, lt: addDays(weekStart, 7) } },
    }),
    prisma.appointment.aggregate({
      where: { status: 'COMPLETED', startsAt: { gte: monthStart, lt: monthEnd } },
      _sum: { priceAtBooking: true },
    }),
  ]);

  return {
    today: todayCount,
    thisWeek: weekCount,
    monthRevenue: decimalToNumber(monthRevenue._sum.priceAtBooking ?? 0),
  };
}
