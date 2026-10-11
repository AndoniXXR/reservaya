import type { AppointmentStatus } from './appointments';
import { apiClient } from './client';

export interface StatsOverview {
  range: { from: string; to: string };
  totalsByStatus: Record<AppointmentStatus, number>;
  revenue: number;
  noShowRate: number | null;
  occupancyByStaff: {
    staffId: string;
    staffName: string;
    bookedMinutes: number;
    workingMinutes: number;
    rate: number;
  }[];
  appointmentsPerDay: { date: string; count: number }[];
  topServices: { serviceId: string; serviceName: string; count: number }[];
  highlights: { today: number; thisWeek: number; monthRevenue: number };
}

export async function fetchOverview(range: { from: string; to: string }) {
  const { data } = await apiClient.get<StatsOverview>('/stats/overview', { params: range });
  return data;
}
