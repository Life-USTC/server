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

  const buildUrl = (extensions: "base" | "all") => {
    const url = new URL("https://restapi.amap.com/v3/weather/weatherInfo");
    url.searchParams.set("key", key);
    url.searchParams.set("city", location.amapAdcode);
    url.searchParams.set("extensions", extensions);
    return url.toString();
  };

  const fetchJson = async (extensions: "base" | "all") => {
    const response = await fetch(buildUrl(extensions), {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      throw new Error(`Amap HTTP ${response.status}`);
    }
    return (await response.json()) as unknown;
  };

  try {
    // extensions=base returns lives (current weather) only, extensions=all
    // returns forecasts only, so both calls are needed.
    const [baseResult, allResult] = await Promise.allSettled([
      fetchJson("base"),
      fetchJson("all"),
    ]);
    if (baseResult.status === "rejected" && allResult.status === "rejected") {
      return {
        ok: false,
        error:
          baseResult.reason instanceof Error
            ? baseResult.reason
            : new Error(String(baseResult.reason)),
      };
    }

    const baseRaw = baseResult.status === "fulfilled" ? baseResult.value : null;
    const allRaw = allResult.status === "fulfilled" ? allResult.value : null;
    const raw = {
      ...(baseRaw ? { livesBase: baseRaw } : {}),
      ...(allRaw ? { forecastsAll: allRaw } : {}),
    };

    const typedBase = baseRaw as {
      lives?: Array<{
        weather?: string;
        temperature?: string;
        winddirection?: string;
        windpower?: string;
        humidity?: string;
        reporttime?: string;
      }>;
    } | null;
    const typedAll = allRaw as {
      forecasts?: Array<{
        casts?: Array<{
          date?: string;
          dayweather?: string;
          nightweather?: string;
          daytemp?: string;
          nighttemp?: string;
        }>;
      }>;
    } | null;

    const live = typedBase?.lives?.[0];
    const casts = typedAll?.forecasts?.[0]?.casts ?? [];

    const data: AmapWeatherData = {
      current: live
        ? {
            temperature: Number(live.temperature ?? 0),
            humidity: live.humidity ? Number(live.humidity) : undefined,
            windDirection: live.winddirection,
            // windpower is a Beaufort level string like "≤3" or "4".
            windSpeed: live.windpower
              ? Number.parseInt(live.windpower.replace(/[^\d]/g, ""), 10) ||
                undefined
              : undefined,
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
