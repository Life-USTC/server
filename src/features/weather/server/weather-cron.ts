import { refreshWeatherSnapshot } from "./weather-service";
import type { WeatherLocationKey } from "./weather-types";

export async function runWeatherCronSnapshot(
  locationKey: WeatherLocationKey,
): Promise<{ locationKey: WeatherLocationKey; refreshed: boolean }> {
  // Cron always bypasses the KV cache (its key outlives the cron interval),
  // so every tick pulls fresh provider data, refills the cache, and writes a
  // history row.
  const snapshot = await refreshWeatherSnapshot(locationKey);
  return { locationKey, refreshed: snapshot !== null };
}
