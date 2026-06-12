import { apiFetch, mergeHeaders } from "@/lib/api/client-fetch";
import type { ApiOptions, ApiResult } from "@/lib/api/client-types";
import { buildApiUrl } from "@/lib/api/client-url";

export async function apiRequest<T>(
  method: string,
  path: string,
  options?: ApiOptions,
): Promise<ApiResult<T>> {
  const url = buildApiUrl(path, options);

  const headers = mergeHeaders(
    options?.body !== undefined
      ? { "Content-Type": "application/json" }
      : undefined,
    options?.headers,
  );

  const init: RequestInit = {
    method,
    headers,
    credentials: options?.credentials,
  };

  if (options?.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await apiFetch(url, init);

  let body: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
  }

  if (response.ok) {
    return { data: body as T, error: undefined, response };
  }

  return { data: undefined, error: body, response };
}
