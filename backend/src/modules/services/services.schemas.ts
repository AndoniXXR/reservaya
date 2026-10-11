import { z } from 'zod';

const serviceFields = {
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').nullable(),
  durationMinutes: z.number().int().min(15, 'Mínimo 15 minutos').max(240, 'Máximo 240 minutos'),
  price: z
    .number()
    .positive('El precio debe ser mayor que 0')
    .max(99_999, 'Precio demasiado alto')
    .multipleOf(0.01, 'Máximo dos decimales'),
};

export const createServiceSchema = z.object({
  ...serviceFields,
  description: serviceFields.description.optional(),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = z
  .object(serviceFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No hay cambios' });
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const listServicesQuerySchema = z.object({
  all: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const idParamSchema = z.object({ id: z.uuid('Identificador inválido') });
