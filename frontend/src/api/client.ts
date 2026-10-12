import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

// En producción el frontend y la API comparten origen (/api); en desarrollo la API corre aparte
export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');

// El access token vive solo en memoria (nunca en localStorage).
let accessToken: string | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10_000,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// Una sola promesa compartida: si varias peticiones reciben 401 a la vez,
// solo una llama a /refresh y las demás esperan su resultado.
let refreshPromise: Promise<string | null> | null = null;

export function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= axios
    .post<{ accessToken: string }>(`${API_URL}/auth/refresh`, null, { withCredentials: true })
    .then((res) => {
      tokenStore.set(res.data.accessToken);
      return res.data.accessToken;
    })
    .catch(() => {
      tokenStore.set(null);
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const NO_RETRY_PATHS = ['/auth/refresh', '/auth/login', '/auth/register', '/auth/logout'];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableConfig | undefined;
    const url = config?.url ?? '';
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retried ||
      NO_RETRY_PATHS.some((path) => url.includes(path))
    ) {
      throw error;
    }
    config._retried = true;
    const token = await refreshAccessToken();
    if (!token) throw error;
    return apiClient(config);
  },
);
