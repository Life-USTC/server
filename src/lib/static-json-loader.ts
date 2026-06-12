import { fetchLifeUstcStaticJson } from "@/lib/static-assets";

export function createStaticJsonLoader<T>(pathname: string, fallback: T) {
  let cached: T | null = null;

  return async () => {
    if (cached !== null) return cached;
    cached = await fetchLifeUstcStaticJson(pathname, fallback);
    return cached;
  };
}
