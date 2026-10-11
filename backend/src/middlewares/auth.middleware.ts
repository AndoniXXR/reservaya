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

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(AppError.unauthorized());
    return;
  }
  const payload = verifyAccessToken(header.slice('Bearer '.length));
  if (!payload) {
    next(AppError.unauthorized('Tu sesión expiró, vuelve a iniciar sesión'));
    return;
  }
  req.user = { id: payload.sub, role: payload.role };
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
