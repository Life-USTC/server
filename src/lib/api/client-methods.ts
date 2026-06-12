import { apiRequest } from "@/lib/api/client-request";
import type { ApiOptions } from "@/lib/api/client-types";

export const apiClient = {
  GET: <T = unknown>(path: string, options?: ApiOptions) =>
    apiRequest<T>("GET", path, options),
  POST: <T = unknown>(path: string, options?: ApiOptions) =>
    apiRequest<T>("POST", path, options),
  PUT: <T = unknown>(path: string, options?: ApiOptions) =>
    apiRequest<T>("PUT", path, options),
  DELETE: <T = unknown>(path: string, options?: ApiOptions) =>
    apiRequest<T>("DELETE", path, options),
  PATCH: <T = unknown>(path: string, options?: ApiOptions) =>
    apiRequest<T>("PATCH", path, options),
};
