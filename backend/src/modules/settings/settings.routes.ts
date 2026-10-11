import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.ts';
import { validateBody } from '../../middlewares/validate.middleware.ts';
import * as controller from './settings.controller.ts';
import { updateSettingsSchema } from './settings.schemas.ts';

export const settingsRouter = Router();

settingsRouter.get('/', controller.getSettings);
settingsRouter.patch(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validateBody(updateSettingsSchema),
  controller.updateSettings,
);
