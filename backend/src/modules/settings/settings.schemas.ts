import { z } from 'zod';

export const updateSettingsSchema = z
  .object({
    businessName: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres'),
    slotIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
    minAdvanceHours: z.number().int().min(0).max(72),
    maxAdvanceDays: z.number().int().min(1).max(365),
    cancellationHours: z.number().int().min(0).max(168),
    contactPhone: z.string().trim().max(20).nullable(),
    address: z.string().trim().max(200).nullable(),
    description: z.string().trim().max(500).nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No hay cambios' });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
