import { Router } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.ts';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate.middleware.ts';
import { idParamSchema } from '../services/services.schemas.ts';
import * as controller from './appointments.controller.ts';
import {
  adminListQuerySchema,
  createAppointmentSchema,
  mineQuerySchema,
  updateStatusSchema,
} from './appointments.schemas.ts';

export const appointmentsRouter = Router();

appointmentsRouter.use(requireAuth);

// Solo clientes reservan; el admin gestiona desde el panel (reservar a nombre de un cliente es una mejora futura)
appointmentsRouter.post(
  '/',
  requireRole('CLIENT'),
  validateBody(createAppointmentSchema),
  controller.create,
);
appointmentsRouter.get('/mine', validateQuery(mineQuerySchema), controller.mine);
appointmentsRouter.patch('/:id/cancel', validateParams(idParamSchema), controller.cancel);

appointmentsRouter.get(
  '/',
  requireRole('ADMIN'),
  validateQuery(adminListQuerySchema),
  controller.list,
);
appointmentsRouter.patch(
  '/:id/status',
  requireRole('ADMIN'),
  validateParams(idParamSchema),
  validateBody(updateStatusSchema),
  controller.updateStatus,
);
