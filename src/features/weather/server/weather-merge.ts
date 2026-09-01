import { type AmapWeatherData, normalizeAmapCondition } from "./amap-adapter";
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
          condition: normalizeOpenMeteoCondition(
            openMeteo.data.current?.weather_code ?? -1,
          ),
        }
      : { temperature: 0, condition: { text: "未知", icon: "unknown" } };

  const hourlySource = openMeteo.ok ? openMeteo.data.hourly : undefined;
  const hourly: WeatherHourly[] = (hourlySource?.time ?? [])
    .slice(0, 24)
    .map((time, i) => ({
      at: time,
      temperature: hourlySource?.temperature_2m[i] ?? 0,
      condition: normalizeOpenMeteoCondition(
        hourlySource?.weather_code[i] ?? -1,
      ),
      precipitationProbability: hourlySource?.precipitation_probability?.[i],
      precipitationAmount: hourlySource?.precipitation?.[i],
    }));

  const daily: WeatherDaily[] = amap.ok
    ? (amap.data.daily ?? []).map((d) => ({
        date: d.date,
        temperatureHigh: d.temperatureHigh,
        temperatureLow: d.temperatureLow,
        condition: normalizeAmapCondition(d.weather, d.weatherCode),
      }))
    : openMeteo.ok
      ? (() => {
          const dailySource = openMeteo.data.daily;
          return (dailySource?.time ?? []).map((time, i) => ({
            date: time,
            temperatureHigh: dailySource?.temperature_2m_max[i] ?? 0,
            temperatureLow: dailySource?.temperature_2m_min[i] ?? 0,
            condition: normalizeOpenMeteoCondition(
              dailySource?.weather_code[i] ?? -1,
            ),
          }));
        })()
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
