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
  if (apiError) return apiError.message;
  if (isAxiosError(error) && !error.response) return 'No se pudo conectar con el servidor';
  return fallback;
}
