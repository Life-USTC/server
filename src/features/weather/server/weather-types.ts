export type WeatherLocationKey = "ustc-main" | "ustc-gaoxin";

export type WeatherLocation = {
  key: WeatherLocationKey;
  name: string;
  amapAdcode: string;
  openMeteoLat: number;
  openMeteoLon: number;
};

export const WEATHER_LOCATIONS: WeatherLocation[] = [
  {
    key: "ustc-main",
    name: "本部",
    amapAdcode: "340100",
    openMeteoLat: 31.826,
    openMeteoLon: 117.27,
  },
  {
    key: "ustc-gaoxin",
    name: "高新校区",
    // 340171 (高新区, an economic-zone adcode) has no AMap weather coverage;
    // the Gaoxin campus sits in Shushan district, so use 340104 instead.
    amapAdcode: "340104",
    openMeteoLat: 31.839,
    openMeteoLon: 117.094,
  },
];

export function getWeatherLocation(key: WeatherLocationKey): WeatherLocation;
export function getWeatherLocation(key: string): WeatherLocation | undefined;
export function getWeatherLocation(key: string): WeatherLocation | undefined {
  return WEATHER_LOCATIONS.find((loc) => loc.key === key);
}

export type WeatherCondition = {
  text: string;
  icon: string;
};

export type WeatherCurrent = {
  temperature: number;
  feelsLike?: number;
  humidity?: number;
  windDirection?: string;
  windSpeed?: number;
  pressure?: number;
  visibility?: number;
  condition: WeatherCondition;
};

export type WeatherHourly = {
  at: string;
  temperature: number;
  condition?: WeatherCondition;
  precipitationProbability?: number;
  precipitationAmount?: number;
};

export type WeatherDaily = {
  date: string;
  temperatureHigh: number;
  temperatureLow: number;
  condition?: WeatherCondition;
};

export type WeatherAlert = {
  title: string;
  level?: string;
  content?: string;
  issuedAt?: string;
};

export type WeatherProviderName = "amap" | "open-meteo";

export type WeatherSnapshot = {
  location: {
    key: WeatherLocationKey;
    name: string;
    adcode: string;
  };
  fetchedAt: string;
  providers: WeatherProviderName[];
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  alerts: WeatherAlert[];
  extensions: {
    amap?: unknown;
    openMeteo?: unknown;
  };
};

export type ProviderResult<T> =
  | { ok: true; data: T; raw: unknown }
  | { ok: false; error: Error };
