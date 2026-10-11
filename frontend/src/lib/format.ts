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
