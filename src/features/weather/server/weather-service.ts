import { fetchAmapWeather } from "./amap-adapter";
import { fetchOpenMeteoWeather } from "./open-meteo-adapter";
import { readWeatherCache, writeWeatherCache } from "./weather-cache";
import { writeWeatherHistory } from "./weather-history";
import { mergeWeatherSnapshots } from "./weather-merge";
import { getWeatherLocation, type WeatherSnapshot } from "./weather-types";

export async function getWeatherSnapshot(
  locationKey: string,
): Promise<WeatherSnapshot | null> {
  const snapshot =
    (await readWeatherCache(locationKey)) ??
    (await refreshWeatherSnapshot(locationKey));
  if (!snapshot) return null;

  // Select on every read: the cached provider series also covers tomorrow
  // when the request crosses an hour or midnight after the last refresh.
  const now = Date.now();
  const end = now + 24 * 60 * 60 * 1000;
  return {
    ...snapshot,
    hourly: snapshot.hourly.filter((hour) => {
      const at = Date.parse(hour.at);
      return at >= now && at < end;
    }),
  };
}

export async function refreshWeatherSnapshot(
  locationKey: string,
): Promise<WeatherSnapshot | null> {
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
