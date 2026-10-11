import { Router, type RequestHandler } from 'express';
import { requireAuth, requireRole } from '../../middlewares/auth.middleware.ts';
import { validateQuery } from '../../middlewares/validate.middleware.ts';
import { overviewQuerySchema, type OverviewQuery } from './stats.schemas.ts';
import { getOverview } from './stats.service.ts';

const overview: RequestHandler = async (_req, res) => {
  res.json(await getOverview(res.locals.query as OverviewQuery));
};

export const statsRouter = Router();
statsRouter.get(
  '/overview',
  requireAuth,
  requireRole('ADMIN'),
  validateQuery(overviewQuerySchema),
  overview,
);
