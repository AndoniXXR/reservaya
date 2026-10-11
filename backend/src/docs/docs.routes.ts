import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi.ts';

export const docsRouter = Router();

docsRouter.get('/docs.json', (_req, res) => {
  res.json(openApiDocument);
});
docsRouter.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, { customSiteTitle: 'ReservaYa API' }),
);
