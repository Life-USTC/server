import type { ApiOptions } from "@/lib/api/client-types";

export function buildApiUrl(path: string, options?: ApiOptions): string {
  let url = path;

  if (options?.params?.path) {
    for (const [key, value] of Object.entries(options.params.path)) {
      url = url.replace(`{${key}}`, encodeURIComponent(value));
    }
  }

  if (options?.params?.query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params.query)) {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    if (qs) {
      url = `${url}?${qs}`;
    }
  }

  return url;
}
