import { z } from 'zod';

const name = z.string().trim().min(2, 'Mínimo 2 caracteres').max(80, 'Máximo 80 caracteres');
const email = z.email('Correo inválido').trim().toLowerCase().max(254);
const phone = z
  .string()
  .trim()
  .max(20, 'Máximo 20 caracteres')
  .regex(/^[+\d][\d\s-]*$/, 'Teléfono inválido')
  .nullable()
  .optional();
const password = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[a-zA-Z]/, 'Debe incluir al menos una letra')
  .regex(/\d/, 'Debe incluir al menos un número');

export const registerSchema = z.object({ name, email, phone, password });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateMeSchema = z
  .object({ name, phone })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'No hay cambios' });
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
