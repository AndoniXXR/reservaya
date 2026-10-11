import { isAxiosError } from 'axios';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, string> };
}

export function getApiError(error: unknown): ApiErrorBody['error'] | null {
  if (isAxiosError<ApiErrorBody>(error) && error.response?.data?.error) {
    return error.response.data.error;
  }
  return null;
}

export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado') {
  const apiError = getApiError(error);
  if (apiError) {
    // En errores de validación el detalle por campo es más útil que el mensaje genérico
    const firstDetail = apiError.details ? Object.values(apiError.details)[0] : undefined;
    return firstDetail ? `${apiError.message}: ${firstDetail}` : apiError.message;
  }
  if (isAxiosError(error) && !error.response) return 'No se pudo conectar con el servidor';
  return fallback;
}
