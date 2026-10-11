import { Router } from 'express';
import { checkDatabase } from '../../config/db.ts';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const dbOk = await checkDatabase();
  res
    .status(dbOk ? 200 : 503)
    .json({ status: dbOk ? 'ok' : 'degraded', db: dbOk ? 'ok' : 'error' });
});
