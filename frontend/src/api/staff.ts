import { apiClient } from './client';

export interface StaffServiceSummary {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  active: boolean;
}

export interface Staff {
  id: string;
  name: string;
  bio: string | null;
  active: boolean;
  services: StaffServiceSummary[];
}

export interface StaffPayload {
  name: string;
  bio?: string | null;
  serviceIds?: string[];
}

export interface WorkingHoursBlock {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface WorkingHours extends WorkingHoursBlock {
  id: string;
  staffId: string;
}

export interface TimeOff {
  id: string;
  staffId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface AffectedAppointment {
  id: string;
  startsAt: string;
  endsAt: string;
  clientName: string;
  serviceName: string;
}

export async function fetchStaff(options: { serviceId?: string; all?: boolean } = {}) {
  const { data } = await apiClient.get<{ staff: Staff[] }>('/staff', {
    params: {
      ...(options.serviceId && { serviceId: options.serviceId }),
      ...(options.all && { all: 'true' }),
    },
  });
  return data.staff;
}

export async function fetchStaffMember(id: string) {
  const { data } = await apiClient.get<{ staff: Staff }>(`/staff/${id}`);
  return data.staff;
}

export async function createStaff(payload: StaffPayload) {
  const { data } = await apiClient.post<{ staff: Staff }>('/staff', payload);
  return data.staff;
}

export async function updateStaff(id: string, payload: Partial<StaffPayload>) {
  const { data } = await apiClient.patch<{ staff: Staff }>(`/staff/${id}`, payload);
  return data.staff;
}

export async function toggleStaff(id: string) {
  const { data } = await apiClient.patch<{
    staff: Staff;
    affectedAppointments: AffectedAppointment[];
  }>(`/staff/${id}/toggle`);
  return data;
}

export async function fetchWorkingHours(staffId: string) {
  const { data } = await apiClient.get<{ workingHours: WorkingHours[] }>(
    `/staff/${staffId}/working-hours`,
  );
  return data.workingHours;
}

export async function replaceWorkingHours(staffId: string, blocks: WorkingHoursBlock[]) {
  const { data } = await apiClient.put<{
    workingHours: WorkingHours[];
    affectedAppointments: AffectedAppointment[];
  }>(`/staff/${staffId}/working-hours`, { blocks });
  return data;
}

export async function fetchTimeOff(staffId: string) {
  const { data } = await apiClient.get<{ timeOff: TimeOff[] }>(`/staff/${staffId}/time-off`);
  return data.timeOff;
}

export async function createTimeOff(
  staffId: string,
  payload: { startsAt: string; endsAt: string; reason?: string | null },
) {
  const { data } = await apiClient.post<{
    timeOff: TimeOff;
    affectedAppointments: AffectedAppointment[];
  }>(`/staff/${staffId}/time-off`, payload);
  return data;
}

export async function deleteTimeOff(id: string) {
  await apiClient.delete(`/time-off/${id}`);
}
