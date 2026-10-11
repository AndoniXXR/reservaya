import { TZDate } from '@date-fns/tz';
import { addMinutes } from 'date-fns';
import { overlaps, type Interval } from '../../utils/time.ts';

/**
 * Cálculo de disponibilidad como función pura: recibe datos ya cargados y devuelve
 * los horarios de inicio posibles. No toca la base de datos, así que se prueba
 * de forma unitaria con cualquier combinación de casos.
 */

export interface WorkingBlock {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface StaffAvailabilityData {
  id: string;
  name: string;
  workingHours: WorkingBlock[];
  timeOff: Interval[];
  /** Solo cuentan las citas CONFIRMED o COMPLETED; las canceladas no bloquean */
  appointments: (Interval & { status: string })[];
}

export interface AvailabilityInput {
  /** Día en formato YYYY-MM-DD interpretado en la zona del negocio */
  date: string;
  timezone: string;
  now: Date;
  durationMinutes: number;
  slotIntervalMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  staff: StaffAvailabilityData[];
}

export interface Slot {
  staffId: string;
  staffName: string;
  /** Instante UTC en ISO 8601 */
  startsAt: string;
  /** Hora local "HH:mm" para mostrar */
  label: string;
}

const BLOCKING_STATUSES = new Set(['CONFIRMED', 'COMPLETED']);

export function parseLocalDate(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

/** Instante UTC de una hora "HH:mm" en un día local de la zona dada. */
export function localDateTime(date: string, time: string, timezone: string): Date {
  const { year, month, day } = parseLocalDate(date);
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return new Date(new TZDate(year, month - 1, day, hours, minutes, timezone).getTime());
}

export function localDayOfWeek(date: string, timezone: string): number {
  const { year, month, day } = parseLocalDate(date);
  return new TZDate(year, month - 1, day, timezone).getDay();
}

export function formatLocalTime(instant: Date, timezone: string): string {
  const local = new TZDate(instant, timezone);
  return `${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`;
}

export function computeAvailability(input: AvailabilityInput): Slot[] {
  const dayOfWeek = localDayOfWeek(input.date, input.timezone);
  const earliest = addMinutes(input.now, input.minAdvanceHours * 60);
  const latest = addMinutes(input.now, input.maxAdvanceDays * 24 * 60);
  const slots: Slot[] = [];

  for (const staff of input.staff) {
    const blocking = staff.appointments.filter((a) => BLOCKING_STATUSES.has(a.status));
    const busy: Interval[] = [...staff.timeOff, ...blocking];

    for (const block of staff.workingHours) {
      if (block.dayOfWeek !== dayOfWeek) continue;
      const blockStart = localDateTime(input.date, block.startTime, input.timezone);
      const blockEnd = localDateTime(input.date, block.endTime, input.timezone);

      for (
        let start = blockStart;
        addMinutes(start, input.durationMinutes) <= blockEnd;
        start = addMinutes(start, input.slotIntervalMinutes)
      ) {
        const candidate: Interval = {
          startsAt: start,
          endsAt: addMinutes(start, input.durationMinutes),
        };
        if (candidate.startsAt < earliest || candidate.startsAt > latest) continue;
        if (busy.some((interval) => overlaps(candidate, interval))) continue;
        slots.push({
          staffId: staff.id,
          staffName: staff.name,
          startsAt: candidate.startsAt.toISOString(),
          label: formatLocalTime(candidate.startsAt, input.timezone),
        });
      }
    }
  }

  return slots.sort(
    (a, b) => a.startsAt.localeCompare(b.startsAt) || a.staffName.localeCompare(b.staffName),
  );
}
