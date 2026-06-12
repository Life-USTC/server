export type QueryValue = string | number | boolean | undefined | null;

export type ApiOptions = {
  params?: {
    query?: Record<string, QueryValue>;
    path?: Record<string, string>;
  };
  body?: unknown;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
};

export type ApiSuccess<T> = { data: T; error: undefined; response: Response };
export type ApiError = { data: undefined; error: unknown; response: Response };
export type ApiResult<T> = ApiSuccess<T> | ApiError;
