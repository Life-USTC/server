import { fetchAmapWeather } from "./amap-adapter";
import { fetchOpenMeteoWeather } from "./open-meteo-adapter";
import { readWeatherCache, writeWeatherCache } from "./weather-cache";
import { writeWeatherHistory } from "./weather-history";
import { mergeWeatherSnapshots } from "./weather-merge";
import { getWeatherLocation, type WeatherSnapshot } from "./weather-types";

export async function getWeatherSnapshot(
  locationKey: string,
): Promise<WeatherSnapshot | null> {
  const cached = await readWeatherCache(locationKey);
  if (cached) return cached;

  const location = getWeatherLocation(locationKey);
  if (!location) return null;

  const [amap, openMeteo] = await Promise.all([
    fetchAmapWeather(location),
    fetchOpenMeteoWeather(location),
  ]);

  if (!amap.ok && !openMeteo.ok) {
    return null;
  }

  const snapshot = mergeWeatherSnapshots(location, amap, openMeteo);
  await writeWeatherCache(locationKey, snapshot);
  await writeWeatherHistory(snapshot, {
    amap: amap.ok ? amap.raw : undefined,
    openMeteo: openMeteo.ok ? openMeteo.raw : undefined,
  });

  return snapshot;
}
