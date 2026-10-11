import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function paginate<T>(
  data: T[],
  total: number,
  query: { page: number; pageSize: number },
): Paginated<T> {
  return { data, page: query.page, pageSize: query.pageSize, total };
}
