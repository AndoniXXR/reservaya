import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.middleware.ts';
import { loginRateLimiter, registerRateLimiter } from '../../middlewares/rate-limit.middleware.ts';
import { validateBody } from '../../middlewares/validate.middleware.ts';
import * as controller from './auth.controller.ts';
import { loginSchema, registerSchema, updateMeSchema } from './auth.schemas.ts';

export const authRouter = Router();

authRouter.post(
  '/register',
  registerRateLimiter,
  validateBody(registerSchema),
  controller.register,
);
authRouter.post('/login', loginRateLimiter, validateBody(loginSchema), controller.login);
authRouter.post('/refresh', controller.refresh);
authRouter.post('/logout', controller.logout);
authRouter.get('/me', requireAuth, controller.me);
authRouter.patch('/me', requireAuth, validateBody(updateMeSchema), controller.updateMe);
