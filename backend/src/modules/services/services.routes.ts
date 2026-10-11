import { Router } from 'express';
import { optionalAuth, requireAuth, requireRole } from '../../middlewares/auth.middleware.ts';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate.middleware.ts';
import * as controller from './services.controller.ts';
import {
  createServiceSchema,
  idParamSchema,
  listServicesQuerySchema,
  updateServiceSchema,
} from './services.schemas.ts';

export const servicesRouter = Router();

const adminOnly = [requireAuth, requireRole('ADMIN')];

servicesRouter.get('/', optionalAuth, validateQuery(listServicesQuerySchema), controller.list);
servicesRouter.get('/:id', validateParams(idParamSchema), controller.get);
servicesRouter.post('/', ...adminOnly, validateBody(createServiceSchema), controller.create);
servicesRouter.patch(
  '/:id',
  ...adminOnly,
  validateParams(idParamSchema),
  validateBody(updateServiceSchema),
  controller.update,
);
servicesRouter.patch('/:id/toggle', ...adminOnly, validateParams(idParamSchema), controller.toggle);
