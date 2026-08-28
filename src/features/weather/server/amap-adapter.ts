import { getOptionalTrimmedEnv } from "@/lib/adapters/cloudflare-env";
import type { ProviderResult, WeatherLocation } from "./weather-types";

export type AmapWeatherData = {
  current?: {
    temperature: number;
    feelsLike?: number;
    humidity?: number;
    windDirection?: string;
    windSpeed?: number;
    pressure?: number;
    visibility?: number;
    weather?: string;
    weatherCode?: string;
  };
  daily?: Array<{
    date: string;
    temperatureHigh: number;
    temperatureLow: number;
    weather?: string;
    weatherCode?: string;
  }>;
  hourly?: Array<{
    time: string;
    temperature: number;
    weather?: string;
    weatherCode?: string;
    precipitationProbability?: number;
    precipitation?: number;
  }>;
  alerts?: Array<{
    title: string;
    level?: string;
    content?: string;
    reportTime?: string;
  }>;
};

export function normalizeAmapCondition(
  weather?: string,
  code?: string,
): {
  text: string;
  icon: string;
} {
  return {
    text: weather ?? "未知",
    icon: code ?? "unknown",
  };
}

export async function fetchAmapWeather(
  location: WeatherLocation,
): Promise<ProviderResult<AmapWeatherData>> {
  const key = getOptionalTrimmedEnv("AMAP_API_KEY");
  if (!key) {
    return { ok: false, error: new Error("AMAP_API_KEY is not configured") };
  }

  const url = new URL("https://restapi.amap.com/v3/weather/weatherInfo");
  url.searchParams.set("key", key);
  url.searchParams.set("city", location.amapAdcode);
  url.searchParams.set("extensions", "all");

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return { ok: false, error: new Error(`Amap HTTP ${response.status}`) };
    }
    const raw = (await response.json()) as unknown;
    const typedRaw = raw as {
      lives?: Array<{
        weather?: string;
        temperature?: string;
        winddirection?: string;
        windpower?: string;
        humidity?: string;
        reporttime?: string;
      }>;
      forecasts?: Array<{
        casts?: Array<{
          date?: string;
          dayweather?: string;
          nightweather?: string;
          daytemp?: string;
          nighttemp?: string;
        }>;
      }>;
    };

    const live = typedRaw.lives?.[0];
    const casts = typedRaw.forecasts?.[0]?.casts ?? [];

    const data: AmapWeatherData = {
      current: live
        ? {
            temperature: Number(live.temperature ?? 0),
            humidity: live.humidity ? Number(live.humidity) : undefined,
            windDirection: live.winddirection,
            windSpeed: live.windpower ? Number(live.windpower) : undefined,
            weather: live.weather,
          }
        : undefined,
      daily: casts.slice(0, 7).map((cast) => ({
        date: cast.date ?? "",
        temperatureHigh: Number(cast.daytemp ?? 0),
        temperatureLow: Number(cast.nighttemp ?? 0),
        weather: cast.dayweather,
      })),
      hourly: [],
      alerts: [],
    };

    return { ok: true, data, raw };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
