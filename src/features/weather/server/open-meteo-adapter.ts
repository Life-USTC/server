import type { ProviderResult, WeatherLocation } from "./weather-types";

export type OpenMeteoWeatherData = {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  };
  current?: {
    temperature_2m: number;
    relative_humidity_2m?: number;
    weather_code: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    surface_pressure?: number;
  };
};

const WMO_CODE_TO_TEXT: Record<number, string> = {
  0: "晴",
  1: "主要晴朗",
  2: "多云",
  3: "阴",
  45: "雾",
  48: "雾凇",
  51: "小雨",
  53: "中雨",
  55: "大雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  95: "雷雨",
  96: "雷雨伴冰雹",
  99: "雷雨伴冰雹",
};

export function normalizeOpenMeteoCondition(code: number): {
  text: string;
  icon: string;
} {
  return {
    text: WMO_CODE_TO_TEXT[code] ?? "未知",
    icon: `wmo-${code}`,
  };
}

export async function fetchOpenMeteoWeather(
  location: WeatherLocation,
): Promise<ProviderResult<OpenMeteoWeatherData>> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(location.openMeteoLat));
  url.searchParams.set("longitude", String(location.openMeteoLon));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure",
  );
  url.searchParams.set(
    "hourly",
    "temperature_2m,weather_code,precipitation_probability,precipitation",
  );
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code",
  );
  url.searchParams.set("timezone", "Asia/Shanghai");
  url.searchParams.set("forecast_days", "7");

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return {
        ok: false,
        error: new Error(`Open-Meteo HTTP ${response.status}`),
      };
    }
    const raw = (await response.json()) as unknown;
    return { ok: true, data: raw as OpenMeteoWeatherData, raw };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
