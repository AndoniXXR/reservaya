import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination.ts';

export const createAppointmentSchema = z.object({
  serviceId: z.uuid('Servicio inválido'),
  staffId: z.uuid('Profesional inválido'),
  startsAt: z.iso.datetime({ offset: true, message: 'Fecha inválida' }),
  notes: z.string().trim().max(300, 'Máximo 300 caracteres').nullable().optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const mineQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
});

export const adminListQuerySchema = paginationSchema.extend({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  staffId: z.uuid().optional(),
  status: z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']).optional(),
});
export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export const updateStatusSchema = z.object({
  status: z.enum(['COMPLETED', 'NO_SHOW']),
});
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
