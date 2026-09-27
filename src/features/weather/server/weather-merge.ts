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
  const amapCurrent = amap.ok ? amap.data.current : undefined;
  const openMeteoCurrent = openMeteo.ok ? openMeteo.data.current : undefined;
  const current: WeatherCurrent = amapCurrent
    ? {
        temperature: amapCurrent.temperature,
        feelsLike: amapCurrent.feelsLike,
        humidity: amapCurrent.humidity,
        windDirection: amapCurrent.windDirection,
        windSpeed: amapCurrent.windSpeed,
        pressure: amapCurrent.pressure,
        visibility: amapCurrent.visibility,
        condition: normalizeAmapCondition(
          amapCurrent.weather,
          amapCurrent.weatherCode,
        ),
      }
    : openMeteoCurrent
      ? {
          temperature: openMeteoCurrent.temperature_2m,
          humidity: openMeteoCurrent.relative_humidity_2m,
          condition: normalizeOpenMeteoCondition(
            openMeteoCurrent.weather_code ?? -1,
          ),
        }
      : { temperature: null, condition: { text: "未知", icon: "unknown" } };

  const hourlySource = openMeteo.ok ? openMeteo.data.hourly : undefined;
  const hourly: WeatherHourly[] = (hourlySource?.time ?? []).map((time, i) => ({
    at: time,
    temperature: hourlySource?.temperature_2m[i] ?? 0,
    condition: normalizeOpenMeteoCondition(hourlySource?.weather_code[i] ?? -1),
    precipitationProbability: hourlySource?.precipitation_probability?.[i],
    precipitationAmount: hourlySource?.precipitation?.[i],
  }));

  const amapDaily = amap.ok ? (amap.data.daily ?? []) : [];
  const daily: WeatherDaily[] =
    amapDaily.length > 0
      ? amapDaily.map((d) => ({
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

  const providers: WeatherSnapshot["providers"] = [];
  if (amapCurrent || amapDaily.length > 0) providers.push("amap");
  if (
    (!amapCurrent && openMeteoCurrent) ||
    hourly.length > 0 ||
    (amapDaily.length === 0 && daily.length > 0)
  )
    providers.push("open-meteo");

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
