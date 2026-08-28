import {
  normalizeAmapCondition,
  type AmapWeatherData,
} from "./amap-adapter";
import {
  normalizeOpenMeteoCondition,
  type OpenMeteoWeatherData,
} from "./open-meteo-adapter";
import type {
  ProviderResult,
  WeatherCurrent,
  WeatherDaily,
  WeatherHourly,
  WeatherLocation,
  WeatherSnapshot,
} from "./weather-types";

export function mergeWeatherSnapshots(
  location: WeatherLocation,
  amap: ProviderResult<AmapWeatherData>,
  openMeteo: ProviderResult<OpenMeteoWeatherData>,
): WeatherSnapshot {
  const now = new Date().toISOString();
  const providers: WeatherSnapshot["providers"] = [];
  if (amap.ok) providers.push("amap");
  if (openMeteo.ok) providers.push("open-meteo");

  const current: WeatherCurrent = amap.ok
    ? {
        temperature: amap.data.current?.temperature ?? 0,
        feelsLike: amap.data.current?.feelsLike,
        humidity: amap.data.current?.humidity,
        windDirection: amap.data.current?.windDirection,
        windSpeed: amap.data.current?.windSpeed,
        pressure: amap.data.current?.pressure,
        visibility: amap.data.current?.visibility,
        condition: normalizeAmapCondition(
          amap.data.current?.weather,
          amap.data.current?.weatherCode,
        ),
      }
    : openMeteo.ok
      ? {
          temperature: openMeteo.data.current?.temperature_2m ?? 0,
          humidity: openMeteo.data.current?.relative_humidity_2m,
          windSpeed: openMeteo.data.current?.wind_speed_10m,
          condition: normalizeOpenMeteoCondition(
            openMeteo.data.current?.weather_code ?? -1,
          ),
        }
      : { temperature: 0, condition: { text: "未知", icon: "unknown" } };

  const hourly: WeatherHourly[] = openMeteo.ok
    ? (openMeteo.data.hourly?.time ?? [])
        .slice(0, 24)
        .map((time, i) => ({
          at: time,
          temperature: openMeteo.data.hourly!.temperature_2m[i],
          condition: normalizeOpenMeteoCondition(
            openMeteo.data.hourly!.weather_code[i],
          ),
          precipitationProbability:
            openMeteo.data.hourly!.precipitation_probability?.[i],
          precipitationAmount: openMeteo.data.hourly!.precipitation?.[i],
        }))
    : [];

  const daily: WeatherDaily[] = amap.ok
    ? (amap.data.daily ?? []).map((d) => ({
        date: d.date,
        temperatureHigh: d.temperatureHigh,
        temperatureLow: d.temperatureLow,
        condition: normalizeAmapCondition(d.weather, d.weatherCode),
      }))
    : openMeteo.ok
      ? (openMeteo.data.daily?.time ?? []).map((time, i) => ({
          date: time,
          temperatureHigh: openMeteo.data.daily!.temperature_2m_max[i],
          temperatureLow: openMeteo.data.daily!.temperature_2m_min[i],
          condition: normalizeOpenMeteoCondition(
            openMeteo.data.daily!.weather_code[i],
          ),
        }))
      : [];

  return {
    location: {
      key: location.key,
      name: location.name,
      adcode: location.amapAdcode,
    },
    fetchedAt: now,
    providers,
    current,
    hourly,
    daily,
    alerts: [],
    extensions: {
      amap: amap.ok ? amap.raw : undefined,
      openMeteo: openMeteo.ok ? openMeteo.raw : undefined,
    },
  };
}
