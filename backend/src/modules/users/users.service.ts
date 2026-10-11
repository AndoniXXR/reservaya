import { prisma } from '../../config/prisma.ts';
import type { User } from '../../generated/prisma/client.ts';
import { AppError } from '../../utils/errors.ts';

export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'phone' | 'role' | 'createdAt'>;

// Nunca exponer passwordHash ni tokens
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound('El usuario no existe');
  return toPublicUser(user);
}

export async function updateProfile(
  id: string,
  data: { name?: string; phone?: string | null },
): Promise<PublicUser> {
  const user = await prisma.user.update({ where: { id }, data });
  return toPublicUser(user);
}
