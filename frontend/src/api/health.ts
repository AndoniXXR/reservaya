import { apiClient } from './client';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
}

export async function fetchHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>('/health');
  return data;
}
