import { apiClient } from './client';

export type AppointmentStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';

export interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  priceAtBooking: number;
  notes: string | null;
  service: { id: string; name: string; durationMinutes: number };
  staff: { id: string; name: string };
  client: { id: string; name: string; email: string; phone: string | null };
  cancelledAt: string | null;
  cancelledBy: 'CLIENT' | 'ADMIN' | null;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function createAppointment(payload: {
  serviceId: string;
  staffId: string;
  startsAt: string;
  notes?: string | null;
}) {
  const { data } = await apiClient.post<{ appointment: Appointment }>('/appointments', payload);
  return data.appointment;
}

export async function fetchMyAppointments(scope: 'upcoming' | 'past') {
  const { data } = await apiClient.get<{ appointments: Appointment[] }>('/appointments/mine', {
    params: { scope },
  });
  return data.appointments;
}

export async function cancelAppointment(id: string) {
  const { data } = await apiClient.patch<{ appointment: Appointment }>(
    `/appointments/${id}/cancel`,
  );
  return data.appointment;
}

export interface AdminAppointmentsQuery {
  from?: string;
  to?: string;
  staffId?: string;
  status?: AppointmentStatus;
  page?: number;
  pageSize?: number;
}

export async function fetchAppointments(query: AdminAppointmentsQuery) {
  const { data } = await apiClient.get<Paginated<Appointment>>('/appointments', { params: query });
  return data;
}

export async function updateAppointmentStatus(id: string, status: 'COMPLETED' | 'NO_SHOW') {
  const { data } = await apiClient.patch<{ appointment: Appointment }>(
    `/appointments/${id}/status`,
    { status },
  );
  return data.appointment;
}
