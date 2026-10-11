import type { Request, RequestHandler, Response } from 'express';
import { isProduction } from '../../config/env.ts';
import { getUserById, updateProfile } from '../users/users.service.ts';
import type { LoginInput, RegisterInput, UpdateMeInput } from './auth.schemas.ts';
import * as authService from './auth.service.ts';
import type { AuthSession } from './auth.service.ts';

export const REFRESH_COOKIE = 'refresh_token';
const COOKIE_PATH = '/api/auth';

function setRefreshCookie(res: Response, session: AuthSession) {
  res.cookie(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires: session.refreshExpiresAt,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: COOKIE_PATH,
  });
}

function sendSession(res: Response, session: AuthSession, status = 200) {
  setRefreshCookie(res, session);
  res.status(status).json({ user: session.user, accessToken: session.accessToken });
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export const register: RequestHandler = async (_req, res) => {
  const session = await authService.register(res.locals.body as RegisterInput);
  sendSession(res, session, 201);
};

export const login: RequestHandler = async (_req, res) => {
  const session = await authService.login(res.locals.body as LoginInput);
  sendSession(res, session);
};

export const refresh: RequestHandler = async (req, res) => {
  const token = readRefreshCookie(req);
  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No hay sesión' } });
    return;
  }
  try {
    const session = await authService.refresh(token);
    sendSession(res, session);
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
};

export const me: RequestHandler = async (req, res) => {
  res.json({ user: await getUserById(req.user!.id) });
};

export const updateMe: RequestHandler = async (req, res) => {
  const user = await updateProfile(req.user!.id, res.locals.body as UpdateMeInput);
  res.json({ user });
};
