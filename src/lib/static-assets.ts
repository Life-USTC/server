import { logAppEvent } from "@/lib/log/app-logger";

export const LIFE_USTC_STATIC_ORIGIN = "https://static.life-ustc.tiankaima.dev";

const STATIC_ASSET_FETCH_TIMEOUT_MS = 4_000;

export function getLifeUstcStaticUrl(pathname: string) {
  const normalizedPath = pathname.replace(/^\/+/, "");
  return `${LIFE_USTC_STATIC_ORIGIN}/${normalizedPath}`;
}

async function fetchStatic(pathname: string) {
  const url = getLifeUstcStaticUrl(pathname);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Static asset request timeout: ${url}`));
  }, STATIC_ASSET_FETCH_TIMEOUT_MS);

  let response: Response | undefined;
  try {
    response = await fetch(url, {
      cache: "force-cache",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response) {
    throw new Error(`Static asset request failed without response: ${url}`);
  }

  if (!response.ok) {
    throw new Error(`Static asset request failed: ${response.status} ${url}`);
  }
  return response;
}

export async function fetchLifeUstcStaticJson<T>(
  pathname: string,
  fallback: T,
): Promise<T> {
  try {
    const response = await fetchStatic(pathname);
    return (await response.json()) as T;
  } catch (error) {
    logAppEvent(
      "warn",
      "Failed to load Life@USTC static JSON",
      { source: "life-ustc-static", pathname },
      error,
    );
    return fallback;
  }
}

export async function fetchRequiredLifeUstcStaticJson<T>(
  pathname: string,
): Promise<T> {
  const response = await fetchStatic(pathname);
  return (await response.json()) as T;
}
