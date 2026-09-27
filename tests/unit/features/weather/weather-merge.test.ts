import { describe, expect, it } from "vitest";
import { mergeWeatherSnapshots } from "@/features/weather/server/weather-merge";
import { getWeatherLocation } from "@/features/weather/server/weather-types";

describe("weather merge", () => {
  it("weather.hourly-provider-supplement", () => {
    const time = Array.from({ length: 168 }, (_, i) =>
      new Date(
        Date.parse("2026-09-15T00:00:00+08:00") + i * 3_600_000,
      ).toISOString(),
    );
    const snapshot = mergeWeatherSnapshots(
      getWeatherLocation("ustc-main"),
      { ok: false, error: new Error("unavailable") },
      {
        ok: true,
        raw: {},
        data: {
          hourly: {
            time,
            temperature_2m: time.map((_, i) => i),
            weather_code: time.map(() => 61),
            precipitation_probability: time.map((_, i) => i % 100),
            precipitation: time.map((_, i) => i / 10),
          },
        },
      },
    );
    expect(snapshot.hourly).toHaveLength(168);
    expect(snapshot.hourly[47]).toEqual({
      at: time[47],
      temperature: 47,
      condition: { text: "小雨", icon: "wmo-61" },
      precipitationProbability: 47,
      precipitationAmount: 4.7,
    });
  });

  it("weather.amap-primary", () => {
    const location = getWeatherLocation("ustc-main");
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
    expect(snapshot.providers).not.toContain("open-meteo");
    const fallback = mergeWeatherSnapshots(
      location,
      { ...amap, data: { ...amap.data, current: undefined } },
      openMeteo,
    );
    expect(fallback.current).toMatchObject({
      temperature: 25,
      condition: { text: "晴", icon: "wmo-0" },
    });
    expect(fallback.providers).toEqual(["open-meteo"]);
    const missing = mergeWeatherSnapshots(
      location,
      { ...amap, data: {} },
      { ...openMeteo, data: {} },
    );
    expect(missing.current).toEqual({
      temperature: null,
      condition: { text: "未知", icon: "unknown" },
    });
    expect(missing.providers).toEqual([]);
  });

  it("weather.daily-provider-fallback", () => {
    const location = getWeatherLocation("ustc-main");
    const amap = {
      ok: true as const,
      data: {
        current: {
          temperature: 27,
          weather: "阴",
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
        current: { temperature_2m: 26, weather_code: 3 },
        hourly: {
          time: [],
          temperature_2m: [],
          weather_code: [],
        },
        daily: {
          time: ["2026-09-01"],
          temperature_2m_max: [29],
          temperature_2m_min: [23],
          weather_code: [61],
        },
      },
      raw: {},
    };

    const snapshot = mergeWeatherSnapshots(location, amap, openMeteo);
    expect(snapshot.current.temperature).toBe(27);
    expect(snapshot.daily).toHaveLength(1);
    expect(snapshot.daily[0]).toMatchObject({
      date: "2026-09-01",
      temperatureHigh: 29,
      temperatureLow: 23,
    });
    const preferred = mergeWeatherSnapshots(
      location,
      {
        ...amap,
        data: {
          ...amap.data,
          daily: [
            {
              date: "2026-09-01",
              temperatureHigh: 35,
              temperatureLow: 19,
              weather: "晴",
            },
          ],
        },
      },
      openMeteo,
    );
    expect(preferred.daily[0]).toEqual({
      date: "2026-09-01",
      temperatureHigh: 35,
      temperatureLow: 19,
      condition: { text: "晴", icon: "unknown" },
    });
  });

  it("falls back to Open-Meteo when Amap fails", () => {
    const location = getWeatherLocation("ustc-gaoxin");
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

it("weather.provider-attribution", () => {
  const location = getWeatherLocation("ustc-main");
  const empty = { ok: true as const, data: {}, raw: {} };
  const amapCurrent = {
    ...empty,
    data: { current: { temperature: 20, weather: "晴" } },
  };
  const openCurrent = {
    ...empty,
    data: { current: { temperature_2m: 21, weather_code: 0 } },
  };
  expect(mergeWeatherSnapshots(location, empty, empty).providers).toEqual([]);
  expect(
    mergeWeatherSnapshots(location, amapCurrent, openCurrent).providers,
  ).toEqual(["amap"]);
  expect(mergeWeatherSnapshots(location, empty, openCurrent).providers).toEqual(
    ["open-meteo"],
  );
  const complementary = {
    ...empty,
    data: {
      ...openCurrent.data,
      hourly: {
        time: ["2026-09-15T08:00:00+08:00"],
        temperature_2m: [20],
        weather_code: [0],
      },
    },
  };
  expect(
    mergeWeatherSnapshots(location, amapCurrent, complementary).providers,
  ).toEqual(["amap", "open-meteo"]);
  const amapDaily = {
    ...empty,
    data: {
      daily: [{ date: "2026-09-15", temperatureHigh: 25, temperatureLow: 18 }],
    },
  };
  expect(
    mergeWeatherSnapshots(location, amapDaily, openCurrent).providers,
  ).toEqual(["amap", "open-meteo"]);
});
