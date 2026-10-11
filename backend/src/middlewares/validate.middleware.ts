import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/errors.ts';

type Source = 'body' | 'query' | 'params';

// Express 5 expone req.query y req.params como solo lectura, así que los datos
// validados se guardan en res.locals.<source> y los controllers los leen de ahí.
function validate(source: Source, schema: ZodType): RequestHandler {
  return (req, res, next) => {
    // express.json solo parsea application/json: con otro Content-Type el cuerpo llega vacío
    if (source === 'body' && req.body === undefined && !req.is('application/json')) {
      next(
        new AppError(
          415,
          'VALIDATION_ERROR',
          'Envía el cuerpo en JSON (Content-Type: application/json)',
        ),
      );
      return;
    }
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        details[key] ??= issue.message;
      }
      next(AppError.validation('Datos inválidos', details));
      return;
    }
    res.locals[source] = result.data;
    next();
  };
}

export const validateBody = (schema: ZodType) => validate('body', schema);
export const validateQuery = (schema: ZodType) => validate('query', schema);
export const validateParams = (schema: ZodType) => validate('params', schema);
