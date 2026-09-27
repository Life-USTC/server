import type { ZodType } from "zod";
import { fetchLifeUstcStaticJson } from "@/lib/static-assets";

export function createStaticJsonLoader<T>(
  pathname: string,
  schema: ZodType<T>,
  fallback: T,
) {
  let cached: T | null = null;

  return async () => {
    if (cached !== null) return cached;
    const result = schema.safeParse(
      await fetchLifeUstcStaticJson<unknown>(pathname, fallback),
    );
    cached = result.success ? result.data : fallback;
    return cached;
  };
}
