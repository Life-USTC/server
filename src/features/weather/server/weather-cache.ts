import { getCloudflareWeatherNamespace } from "@/lib/ports/runtime";
import type { WeatherSnapshot } from "./weather-types";

const WEATHER_CACHE_TTL_SECONDS = 15 * 60;
const WEATHER_CACHE_EXPIRATION_TTL_SECONDS = 60 * 60;

export function buildWeatherCacheKey(locationKey: string): string {
  return `weather:${locationKey}:v1`;
}

export async function readWeatherCache(
  locationKey: string,
): Promise<WeatherSnapshot | null> {
  const namespace = getCloudflareWeatherNamespace();
  if (!namespace) return null;
  return namespace.get<WeatherSnapshot>(buildWeatherCacheKey(locationKey), {
    cacheTtl: WEATHER_CACHE_TTL_SECONDS,
    type: "json",
  });
}

export async function writeWeatherCache(
  locationKey: string,
  snapshot: WeatherSnapshot,
): Promise<void> {
  const namespace = getCloudflareWeatherNamespace();
  if (!namespace) return;
  await namespace.put(
    buildWeatherCacheKey(locationKey),
    JSON.stringify(snapshot),
    { expirationTtl: WEATHER_CACHE_EXPIRATION_TTL_SECONDS },
  );
}
