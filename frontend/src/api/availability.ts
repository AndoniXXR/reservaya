import { apiClient } from './client';

export interface Slot {
  staffId: string;
  staffName: string;
  startsAt: string;
  label: string;
}

export interface AvailabilityResponse {
  date: string;
  timezone: string;
  slots: Slot[];
}

export async function fetchAvailability(params: {
  serviceId: string;
  staffId?: string | null;
  date: string;
}) {
  const { data } = await apiClient.get<AvailabilityResponse>('/availability', {
    params: {
      serviceId: params.serviceId,
      date: params.date,
      ...(params.staffId && { staffId: params.staffId }),
    },
  });
  return data;
}
