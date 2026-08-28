import { describe, expect, it } from "vitest";
import { mergeWeatherSnapshots } from "@/features/weather/server/weather-merge";
import { getWeatherLocation } from "@/features/weather/server/weather-types";

describe("weather merge", () => {
  it("prefers Amap current over Open-Meteo", () => {
    const location = getWeatherLocation("ustc-main")!;
    const amap = {
      ok: true as const,
      data: {
        current: {
          temperature: 28,
          weather: "多云",
        },
        daily: [],
        hourly: [],
        alerts: [],
      },
      raw: {},
    };
    const openMeteo = {
      ok: true as const,
      data: {
        current: { temperature_2m: 25, weather_code: 0 },
        hourly: {
          time: [],
          temperature_2m: [],
          weather_code: [],
        },
        daily: {
          time: [],
          temperature_2m_max: [],
          temperature_2m_min: [],
          weather_code: [],
        },
      },
      raw: {},
    };

    const snapshot = mergeWeatherSnapshots(location, amap, openMeteo);
    expect(snapshot.current.temperature).toBe(28);
    expect(snapshot.current.condition.text).toBe("多云");
    expect(snapshot.providers).toContain("amap");
    expect(snapshot.providers).toContain("open-meteo");
  });

  it("falls back to Open-Meteo when Amap fails", () => {
    const location = getWeatherLocation("ustc-gaoxin")!;
    const amap = {
      ok: false as const,
      error: new Error("Amap unavailable"),
    };
    const openMeteo = {
      ok: true as const,
      data: {
        current: { temperature_2m: 22, weather_code: 2 },
        hourly: {
          time: ["2026-08-28T12:00:00+08:00"],
          temperature_2m: [23],
          weather_code: [2],
          precipitation_probability: [10],
          precipitation: [0],
        },
        daily: {
          time: ["2026-08-28"],
          temperature_2m_max: [26],
          temperature_2m_min: [20],
          weather_code: [2],
        },
      },
      raw: {},
    };

    const snapshot = mergeWeatherSnapshots(location, amap, openMeteo);
    expect(snapshot.current.temperature).toBe(22);
    expect(snapshot.providers).toEqual(["open-meteo"]);
    expect(snapshot.hourly).toHaveLength(1);
    expect(snapshot.daily).toHaveLength(1);
  });
});
