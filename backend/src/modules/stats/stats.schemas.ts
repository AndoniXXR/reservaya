import { z } from 'zod';

export const overviewQuerySchema = z
  .object({
    from: z.iso.date('Fecha inválida (YYYY-MM-DD)'),
    to: z.iso.date('Fecha inválida (YYYY-MM-DD)'),
  })
  .refine((q) => q.from <= q.to, { message: 'La fecha final debe ser posterior', path: ['to'] });

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
