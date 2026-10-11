import { useQuery } from '@tanstack/react-query';
import { fetchSettings } from '@/api/settings';

export const settingsQueryKey = ['settings'] as const;

export function useSettings() {
  return useQuery({ queryKey: settingsQueryKey, queryFn: fetchSettings, staleTime: 5 * 60_000 });
}
