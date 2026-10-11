import { Router } from 'express';
import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth.middleware.ts';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate.middleware.ts';
import { idParamSchema } from '../services/services.schemas.ts';
import * as controller from './staff.controller.ts';
import {
  createStaffSchema,
  createTimeOffSchema,
  listStaffQuerySchema,
  putWorkingHoursSchema,
  updateStaffSchema,
} from './staff.schemas.ts';

const adminOnly = [requireAuth, requireRole('ADMIN')];

export const staffRouter = Router();

staffRouter.get('/', optionalAuth, validateQuery(listStaffQuerySchema), controller.list);
staffRouter.get('/:id', validateParams(idParamSchema), controller.get);
staffRouter.post('/', ...adminOnly, validateBody(createStaffSchema), controller.create);
staffRouter.patch(
  '/:id',
  ...adminOnly,
  validateParams(idParamSchema),
  validateBody(updateStaffSchema),
  controller.update,
);
staffRouter.patch('/:id/toggle', ...adminOnly, validateParams(idParamSchema), controller.toggle);

staffRouter.get(
  '/:id/working-hours',
  ...adminOnly,
  validateParams(idParamSchema),
  controller.getWorkingHours,
);
staffRouter.put(
  '/:id/working-hours',
  ...adminOnly,
  validateParams(idParamSchema),
  validateBody(putWorkingHoursSchema),
  controller.putWorkingHours,
);

staffRouter.get(
  '/:id/time-off',
  ...adminOnly,
  validateParams(idParamSchema),
  controller.listTimeOff,
);
staffRouter.post(
  '/:id/time-off',
  ...adminOnly,
  validateParams(idParamSchema),
  validateBody(createTimeOffSchema),
  controller.createTimeOff,
);

// DELETE /api/time-off/:id se monta aparte en app.ts
export const timeOffRouter = Router();
timeOffRouter.delete('/:id', ...adminOnly, validateParams(idParamSchema), controller.deleteTimeOff);
