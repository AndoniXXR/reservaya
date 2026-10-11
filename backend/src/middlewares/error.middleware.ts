import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../config/logger.ts';
import { AppError } from '../utils/errors.ts';

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound('La ruta no existe'));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
    return;
  }

  // Cuerpo JSON malformado (lanzado por express.json)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'JSON inválido' } });
    return;
  }

  logger.error({ err }, 'Error no controlado');
  res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
};
