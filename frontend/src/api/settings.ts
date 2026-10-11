import { apiClient } from './client';

export interface BusinessSettings {
  businessName: string;
  timezone: string;
  slotIntervalMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  cancellationHours: number;
  contactPhone: string | null;
  address: string | null;
  description: string | null;
}

export async function fetchSettings() {
  const { data } = await apiClient.get<{ settings: BusinessSettings }>('/settings');
  return data.settings;
}

export async function updateSettings(payload: Partial<BusinessSettings>) {
  const { data } = await apiClient.patch<{ settings: BusinessSettings }>('/settings', payload);
  return data.settings;
}
