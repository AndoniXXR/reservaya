import type { RequestHandler } from 'express';
import type { Role } from '../generated/prisma/enums.ts';
import { verifyAccessToken } from '../modules/auth/token.service.ts';
import { AppError } from '../utils/errors.ts';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  // Ampliar Request de Express requiere un namespace: es la forma que documenta la librería
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function readBearer(header: string | undefined): AuthUser | null | undefined {
  if (!header?.startsWith('Bearer ')) return undefined;
  const payload = verifyAccessToken(header.slice('Bearer '.length));
  return payload ? { id: payload.sub, role: payload.role } : null;
}

/** Rellena req.user si hay un token válido; no exige sesión. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const user = readBearer(req.headers.authorization);
  if (user) req.user = user;
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const user = readBearer(req.headers.authorization);
  if (user === undefined) {
    next(AppError.unauthorized());
    return;
  }
  if (user === null) {
    next(AppError.unauthorized('Tu sesión expiró, vuelve a iniciar sesión'));
    return;
  }
  req.user = user;
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
