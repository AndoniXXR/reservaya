import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { validateQuery } from '../../middlewares/validate.middleware.ts';
import { getAvailability } from './availability.service.ts';

export const availabilityQuerySchema = z.object({
  serviceId: z.uuid('Servicio inválido'),
  staffId: z.uuid('Profesional inválido').optional(),
  date: z.iso.date('Fecha inválida (YYYY-MM-DD)'),
});

const get: RequestHandler = async (_req, res) => {
  const query = res.locals.query as z.infer<typeof availabilityQuerySchema>;
  res.json(await getAvailability(query));
};

export const availabilityRouter = Router();
availabilityRouter.get('/', validateQuery(availabilityQuerySchema), get);
