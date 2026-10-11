import { apiClient } from './client';

export type Role = 'CLIENT' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  createdAt: string;
}

export interface SessionResponse {
  user: User;
  accessToken: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string | null;
  password: string;
}

export async function register(payload: RegisterPayload) {
  const { data } = await apiClient.post<SessionResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: { email: string; password: string }) {
  const { data } = await apiClient.post<SessionResponse>('/auth/login', payload);
  return data;
}

export async function logout() {
  await apiClient.post('/auth/logout');
}

export async function fetchMe() {
  const { data } = await apiClient.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function updateMe(payload: { name?: string; phone?: string | null }) {
  const { data } = await apiClient.patch<{ user: User }>('/auth/me', payload);
  return data.user;
}
