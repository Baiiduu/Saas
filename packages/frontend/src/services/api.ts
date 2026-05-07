import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  AUTH_REFRESH_TOKEN: 'auth_refresh_token',
  CURRENT_TENANT_ID: 'current_tenant_id',
} as const;

// Simple UUID v4 generator fallback
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: RFC4122 version 4 compliant UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const API_BASE_URL = '/api/v1';

// Request interceptor 0: Handle FormData Content-Type (must be first)
// When FormData is passed, delete the Content-Type header so the browser
// can auto-set multipart/form-data with the correct boundary.
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.data instanceof FormData && config.headers) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Request interceptor 1: Attach Authorization header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Request interceptor 2: Attach X-Tenant-Id header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const tenantId = localStorage.getItem(STORAGE_KEYS.CURRENT_TENANT_ID);
    if (tenantId && config.headers) {
      config.headers['X-Tenant-Id'] = tenantId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Request interceptor 3: Attach X-Request-Id header
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.headers) {
      config.headers['X-Request-Id'] = generateUUID();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 with token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh on 401 and if we haven't already retried
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't try to refresh if the failing request is itself the refresh endpoint
    if (originalRequest.url?.includes('/auth/refresh')) {
      clearAuthData();
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue the request while refresh is in progress
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem(STORAGE_KEYS.AUTH_REFRESH_TOKEN);

    if (!refreshToken) {
      clearAuthData();
      isRefreshing = false;
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post('/api/v1/auth/refresh', {
        refreshToken,
      });

      const newAccessToken = data.data?.accessToken || data.accessToken;
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, newAccessToken);

      processQueue(null, newAccessToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuthData();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

function clearAuthData() {
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.AUTH_REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_TENANT_ID);
  // Redirect to login page
  if (window.location.pathname !== '/auth/login') {
    window.location.href = '/auth/login';
  }
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

function unwrapResponse<T>(payload: T | ApiEnvelope<T>): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'code' in payload &&
    'data' in payload
  ) {
    const envelope = payload as ApiEnvelope<unknown>;
    if (envelope.meta && Array.isArray(envelope.data)) {
      return {
        items: envelope.data,
        meta: envelope.meta,
      } as T;
    }
    return envelope.data as T;
  }
  return payload as T;
}

// Helper functions with generic typing
export async function get<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.get<T>(url, config);
  return unwrapResponse(response.data);
}

export async function post<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.post<T>(url, data, config);
  return unwrapResponse(response.data);
}

export async function put<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.put<T>(url, data, config);
  return unwrapResponse(response.data);
}

export async function patch<T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.patch<T>(url, data, config);
  return unwrapResponse(response.data);
}

export async function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const response = await api.delete<T>(url, config);
  return unwrapResponse(response.data);
}

export default api;
