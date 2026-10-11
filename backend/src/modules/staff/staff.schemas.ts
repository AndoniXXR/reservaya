import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const time = z.string().regex(timeRegex, 'Hora inválida (HH:mm)');

const staffFields = {
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  bio: z.string().trim().max(300, 'Máximo 300 caracteres').nullable(),
  serviceIds: z.array(z.uuid()).max(50),
};

export const createStaffSchema = z.object({
  name: staffFields.name,
  bio: staffFields.bio.optional(),
  serviceIds: staffFields.serviceIds.optional(),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateStaffSchema = z
  .object(staffFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No hay cambios' });
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

export const listStaffQuerySchema = z.object({
  serviceId: z.uuid().optional(),
  all: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const workingHoursBlockSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
  })
  .refine((block) => block.startTime < block.endTime, {
    message: 'La hora de fin debe ser posterior a la de inicio',
    path: ['endTime'],
  });

export const putWorkingHoursSchema = z.object({
  blocks: z.array(workingHoursBlockSchema).max(7 * 6, 'Demasiados bloques'),
});
export type PutWorkingHoursInput = z.infer<typeof putWorkingHoursSchema>;

export const createTimeOffSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
    endsAt: z.iso.datetime({ offset: true }).transform((value) => new Date(value)),
    reason: z.string().trim().max(120, 'Máximo 120 caracteres').nullable().optional(),
  })
  .refine((data) => data.startsAt < data.endsAt, {
    message: 'El fin debe ser posterior al inicio',
    path: ['endsAt'],
  });
export type CreateTimeOffInput = z.infer<typeof createTimeOffSchema>;
