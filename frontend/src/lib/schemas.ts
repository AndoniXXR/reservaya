import { z } from 'zod';

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Mínimo 2 caracteres')
  .max(80, 'Máximo 80 caracteres');

export const emailSchema = z.email('Correo inválido').trim().toLowerCase();

export const phoneSchema = z
  .string()
  .trim()
  .max(20, 'Máximo 20 caracteres')
  .regex(/^$|^[+\d][\d\s-]*$/, 'Teléfono inválido');

export const passwordSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[a-zA-Z]/, 'Debe incluir al menos una letra')
  .regex(/\d/, 'Debe incluir al menos un número');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
export type RegisterForm = z.infer<typeof registerSchema>;

export const profileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
});
export type ProfileForm = z.infer<typeof profileSchema>;
