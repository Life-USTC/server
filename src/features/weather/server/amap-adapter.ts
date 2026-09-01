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
    // returns forecasts only, so both calls are needed. AMap's free-tier QPS
    // limit rejects concurrent requests (infocode 10021), and both campus
    // crons can fire in the same second, so fetch sequentially.
    const settle = async (extensions: "base" | "all") => {
      try {
        return {
          status: "fulfilled" as const,
          value: await fetchJson(extensions),
        };
      } catch (reason) {
        return { status: "rejected" as const, reason };
      }
    };
    const baseResult = await settle("base");
    const allResult = await settle("all");
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

    const rawLive = typedBase?.lives?.[0];
    // AMap can answer 200/OK with empty payloads (e.g. `lives: [[]]`) for
    // adcodes it does not cover — treat that as provider failure so the
    // merge can fall back to Open-Meteo.
    const live =
      rawLive && !Array.isArray(rawLive) && rawLive.temperature !== undefined
        ? rawLive
        : undefined;
    const casts = (typedAll?.forecasts?.[0]?.casts ?? []).filter(
      (cast) => cast && cast.date !== undefined,
    );
    if (!live && casts.length === 0) {
      return {
        ok: false,
        error: new Error("Amap returned no weather data for this adcode"),
      };
    }

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
