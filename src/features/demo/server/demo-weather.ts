import { DEMO_REFERENCE_NOW } from "@/features/demo/lib/demo-types";
import type {
  WeatherLocationKey,
  WeatherSnapshot,
} from "@/features/weather/server/weather-types";
import type { AppLocale } from "@/i18n/config";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";

/** Fictional model facts only: no provider identity or observedAt is invented. */
export function getDemoWeatherSnapshot(
  locationKey: WeatherLocationKey,
  locale: AppLocale,
): WeatherSnapshot {
  const offset = locationKey === "ustc-main" ? 0 : 1;
  const reference = shanghaiDayjs(DEMO_REFERENCE_NOW);
  const condition = {
    text: locale === "en-us" ? "Fictional · Sunny" : "虚构 · 晴",
    icon: "wmo-0",
  };
  return {
    location: {
      key: locationKey,
      name:
        locale === "en-us"
          ? offset
            ? "Gaoxin campus · Fictional weather"
            : "Main campus · Fictional weather"
          : offset
            ? "高新校区 · 虚构天气"
            : "本部 · 虚构天气",
      adcode: "",
    },
    fetchedAt: DEMO_REFERENCE_NOW,
    providers: [],
    current: {
      temperature: 24 + offset,
      feelsLike: 24 + offset,
      humidity: 60,
      condition,
    },
    hourly: [24, 25, 26, 27, 27, 26, 25, 24, 23, 22, 22, 21].map(
      (temperature, index) => ({
        at: reference.add(index, "hour").format("YYYY-MM-DDTHH:mm:ssZ"),
        temperature: temperature + offset,
        condition,
        precipitationProbability: 0,
        precipitationAmount: 0,
      }),
    ),
    daily: Array.from({ length: 7 }, (_, index) => ({
      date: reference.add(index, "day").format("YYYY-MM-DD"),
      temperatureHigh: 27 + offset,
      temperatureLow: 20 + offset,
      condition,
    })),
    alerts: [],
    extensions: {},
  };
}
