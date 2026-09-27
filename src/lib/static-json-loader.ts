import type { ZodType } from "zod";
import { fetchLifeUstcStaticJson } from "@/lib/static-assets";

const STATIC_JSON_CACHE_TTL_MS = 300_000;

export function createStaticJsonLoader<T>(
  pathname: string,
  schema: ZodType<T>,
  fallback: T,
) {
  let cached: T | null = null;
  let expiresAt = 0;

  return async () => {
    if (cached !== null && expiresAt > Date.now()) return cached;
    const result = schema.safeParse(
      await fetchLifeUstcStaticJson<unknown>(pathname, fallback),
    );
    cached = result.success ? result.data : fallback;
    expiresAt = Date.now() + STATIC_JSON_CACHE_TTL_MS;
    return cached;
  };
}
