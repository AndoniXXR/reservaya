import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../utils/errors.ts';

type Source = 'body' | 'query' | 'params';

// Express 5 expone req.query y req.params como solo lectura, así que los datos
// validados se guardan en res.locals.<source> y los controllers los leen de ahí.
function validate(source: Source, schema: ZodType): RequestHandler {
  return (req, res, next) => {
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
