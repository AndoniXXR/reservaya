import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const DEFAULT_TIMEZONE = 'America/Guatemala';

/** "Q 150.00" */
export function formatPrice(amount: number): string {
  return `Q ${amount.toFixed(2)}`;
}

/** "30 min" / "1 h 30 min" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function inZone(value: string | Date, timezone: string): TZDate {
  return new TZDate(typeof value === 'string' ? new Date(value) : value, timezone);
}

/** "martes 3 de noviembre, 09:00" */
export function formatDateTime(value: string | Date, timezone = DEFAULT_TIMEZONE): string {
  return format(inZone(value, timezone), "EEEE d 'de' MMMM, HH:mm", { locale: es });
}

/** "martes 3 de noviembre" */
export function formatDate(value: string | Date, timezone = DEFAULT_TIMEZONE): string {
  return format(inZone(value, timezone), "EEEE d 'de' MMMM", { locale: es });
}

/** "09:00" */
export function formatTime(value: string | Date, timezone = DEFAULT_TIMEZONE): string {
  return format(inZone(value, timezone), 'HH:mm');
}

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** YYYY-MM-DD de una fecha en hora local del navegador. */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Rango de un día libre. Los días completos (00:00 → 00:00 del día siguiente) se muestran
 * como fechas sin hora: "domingo 18 de octubre" o "sábado 17 de octubre – lunes 19 de octubre".
 */
export function formatTimeOffRange(
  range: { startsAt: string; endsAt: string },
  timezone = DEFAULT_TIMEZONE,
): string {
  const start = new TZDate(new Date(range.startsAt), timezone);
  const end = new TZDate(new Date(range.endsAt), timezone);
  const isMidnight = (d: TZDate) => d.getHours() === 0 && d.getMinutes() === 0;
  if (isMidnight(start) && isMidnight(end)) {
    const lastDay = new TZDate(end.getTime() - 24 * 60 * 60 * 1000, timezone);
    const first = formatDate(start, timezone);
    const last = formatDate(lastDay, timezone);
    return first === last ? first : `${first} – ${last}`;
  }
  return `${formatDateTime(start, timezone)} → ${formatDateTime(end, timezone)}`;
}
