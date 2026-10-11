import bcrypt from 'bcryptjs';
import { env } from '../../config/env.ts';
import { logger } from '../../config/logger.ts';
import { prisma } from '../../config/prisma.ts';
import type { User } from '../../generated/prisma/client.ts';
import { AppError } from '../../utils/errors.ts';
import { toPublicUser, type PublicUser } from '../users/users.service.ts';
import type { LoginInput, RegisterInput } from './auth.schemas.ts';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './token.service.ts';

const BCRYPT_COST = 12;
// Hash contra el que se compara cuando el correo no existe, para que el tiempo de
// respuesta no revele si una cuenta existe
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_COST);

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
  refreshExpiresAt: Date;
}

async function issueSession(user: User): Promise<AuthSession> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const stored = await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      expiresAt: refreshExpiresAt,
    },
  });
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken,
    refreshTokenId: stored.id,
    refreshExpiresAt,
  };
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict('Ya existe una cuenta con ese correo');

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  // El registro público siempre crea CLIENT; el admin se crea con el seed
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, phone: input.phone ?? null, passwordHash },
  });
  return issueSession(user);
}

export async function login(input: LoginInput): Promise<AuthSession> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw AppError.unauthorized('Correo o contraseña incorrectos');
  return issueSession(user);
}

/**
 * Rota el refresh token: revoca el actual y emite uno nuevo.
 *
 * Si el token ya fue rotado hace menos de REFRESH_GRACE_SECONDS (dos pestañas, o el doble
 * montaje de React en desarrollo) se acepta igualmente y se emite otro nuevo. Si fue
 * revocado fuera de la gracia o por logout, se considera un posible robo y se revocan
 * todos los tokens del usuario.
 */
export async function refresh(rawToken: string): Promise<AuthSession> {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
    include: { user: true },
  });
  if (!stored) throw AppError.unauthorized('Sesión inválida');

  const now = Date.now();
  if (stored.expiresAt.getTime() <= now) throw AppError.unauthorized('Tu sesión expiró');

  if (stored.revokedAt) {
    const withinGrace =
      stored.replacedById !== null &&
      now - stored.revokedAt.getTime() <= env.REFRESH_GRACE_SECONDS * 1000;
    if (!withinGrace) {
      logger.warn({ userId: stored.userId }, 'Reutilización de refresh token: se revocan todos');
      await prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw AppError.unauthorized('Sesión inválida');
    }
    return issueSession(stored.user);
  }

  const session = await issueSession(stored.user);
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedById: session.refreshTokenId },
  });
  return session;
}

export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
