import { apiClient } from './client';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  active: boolean;
}

export interface ServicePayload {
  name: string;
  description?: string | null;
  durationMinutes: number;
  price: number;
}

export async function fetchServices(options: { all?: boolean } = {}) {
  const { data } = await apiClient.get<{ services: Service[] }>('/services', {
    params: options.all ? { all: 'true' } : undefined,
  });
  return data.services;
}

export async function createService(payload: ServicePayload) {
  const { data } = await apiClient.post<{ service: Service }>('/services', payload);
  return data.service;
}

export async function updateService(id: string, payload: Partial<ServicePayload>) {
  const { data } = await apiClient.patch<{ service: Service }>(`/services/${id}`, payload);
  return data.service;
}

export async function toggleService(id: string) {
  const { data } = await apiClient.patch<{ service: Service }>(`/services/${id}/toggle`);
  return data.service;
}
