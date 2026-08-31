import { getWeatherSnapshot } from "./weather-service";
import type { WeatherLocationKey } from "./weather-types";

export async function runWeatherCronSnapshot(
  locationKey: WeatherLocationKey,
): Promise<{ locationKey: WeatherLocationKey; refreshed: boolean }> {
  // The 15-minute KV cache is always stale by cron time (20/30 minutes),
  // so this pulls fresh provider data, refills the cache, and writes history.
  const snapshot = await getWeatherSnapshot(locationKey);
  return { locationKey, refreshed: snapshot !== null };
}
