import type { AppointmentStatus } from '@/api/appointments';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  CONFIRMED: 'Confirmada',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Completada',
  NO_SHOW: 'No asistió',
};

export const STATUS_TONES: Record<AppointmentStatus, 'blue' | 'gray' | 'green' | 'red'> = {
  CONFIRMED: 'blue',
  CANCELLED: 'gray',
  COMPLETED: 'green',
  NO_SHOW: 'red',
};
