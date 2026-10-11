export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export type ErrorDetails = Record<string, string>;

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: ErrorDetails,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static validation(message = 'Datos inválidos', details?: ErrorDetails): AppError {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Debes iniciar sesión'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'No tienes permiso para esta acción'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'El recurso no existe'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }

  static businessRule(message: string, details?: ErrorDetails): AppError {
    return new AppError(422, 'BUSINESS_RULE', message, details);
  }
}
