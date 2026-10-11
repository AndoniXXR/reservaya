/** "09:30" → 570 minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
}

/** 570 → "09:30". */
export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export interface Interval {
  startsAt: Date;
  endsAt: Date;
}

/** Traslape de intervalos semiabiertos [inicio, fin). */
export const overlaps = (a: Interval, b: Interval): boolean =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt;
