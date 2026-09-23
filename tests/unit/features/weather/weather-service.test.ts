import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/weather/server/weather-cache", () => ({
  readWeatherCache: vi.fn().mockResolvedValue(null),
  writeWeatherCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/weather/server/weather-history", () => ({
  writeWeatherHistory: vi.fn().mockResolvedValue(undefined),
}));

describe("weather service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    ["2026-09-15T00:00:00+08:00", "2026-09-15T00:00:00+08:00"],
    ["2026-09-15T15:35:00+08:00", "2026-09-15T16:00:00+08:00"],
    ["2026-09-15T23:59:00+08:00", "2026-09-16T00:00:00+08:00"],
    ["2026-09-16T00:01:00+08:00", "2026-09-16T01:00:00+08:00"],
  ])(
    "selects 24 upcoming hours from the same cache at %s",
    async (now, first) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));
      const { mergeWeatherSnapshots } = await import(
        "@/features/weather/server/weather-merge"
      );
      const { getWeatherLocation } = await import(
        "@/features/weather/server/weather-types"
      );
      const { readWeatherCache } = await import(
        "@/features/weather/server/weather-cache"
      );
      const { getWeatherSnapshot } = await import(
        "@/features/weather/server/weather-service"
      );
      const time = Array.from({ length: 72 }, (_, i) =>
        new Date(
          Date.parse("2026-09-15T00:00:00+08:00") + i * 3_600_000,
        ).toISOString(),
      );
      const cached = mergeWeatherSnapshots(
        getWeatherLocation("ustc-main"),
        { ok: false, error: new Error("unavailable") },
        {
          ok: true,
          raw: {},
          data: {
            hourly: {
              time,
              temperature_2m: time.map((_, i) => i),
              weather_code: time.map(() => 2),
            },
          },
        },
      );
      vi.mocked(readWeatherCache).mockResolvedValueOnce(cached);
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const result = await getWeatherSnapshot("ustc-main");
      expect(result?.hourly).toHaveLength(24);
      expect(Date.parse(result?.hourly[0].at ?? "")).toBe(Date.parse(first));
      expect(Date.parse(result?.hourly[23].at ?? "")).toBe(
        Date.parse(first) + 23 * 3_600_000,
      );
      expect(cached.hourly).toHaveLength(72);
      expect(fetchMock).not.toHaveBeenCalled();

      vi.setSystemTime(new Date("2026-09-19T00:00:00+08:00"));
      vi.mocked(readWeatherCache).mockResolvedValueOnce(cached);
      expect((await getWeatherSnapshot("ustc-main"))?.hourly).toEqual([]);
    },
  );

  it("returns null for unknown location", async () => {
    const { getWeatherSnapshot } = await import(
      "@/features/weather/server/weather-service"
    );
    const result = await getWeatherSnapshot("unknown");
    expect(result).toBeNull();
  });

  it("merges provider results and caches tomorrow before selecting the public window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-15T23:30:00+08:00"));
    const time = Array.from({ length: 72 }, (_, i) =>
      new Date(
        Date.parse("2026-09-15T00:00:00+08:00") + i * 3_600_000,
      ).toISOString(),
    );
    vi.stubEnv("AMAP_API_KEY", "test-amap-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string | Request) => {
        const urlString = typeof url === "string" ? url : url.toString();
        const parsedUrl = new URL(urlString);
        if (parsedUrl.hostname === "restapi.amap.com") {
          // The real AMap API returns lives only with extensions=base and
          // forecasts only with extensions=all.
          if (parsedUrl.searchParams.get("extensions") === "all") {
            return Promise.resolve({
              ok: true,
              json: () =>
                Promise.resolve({
                  forecasts: [
                    {
                      casts: [
                        {
                          date: "2026-08-28",
                          dayweather: "多云",
                          nightweather: "晴",
                          daytemp: "32",
                          nighttemp: "24",
                        },
                      ],
                    },
                  ],
                }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                lives: [
                  {
                    temperature: "28",
                    weather: "多云",
                  },
                ],
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              current: {
                temperature_2m: 25,
                weather_code: 0,
              },
              hourly: {
                time,
                temperature_2m: time.map(() => 25),
                weather_code: time.map(() => 0),
              },
              daily: {
                time: [],
                temperature_2m_max: [],
                temperature_2m_min: [],
                weather_code: [],
              },
            }),
        });
      }),
    );

    const { getWeatherSnapshot } = await import(
      "@/features/weather/server/weather-service"
    );
    const result = await getWeatherSnapshot("ustc-main");
    expect(result).not.toBeNull();
    expect(result?.current.temperature).toBe(28);
    expect(result?.hourly).toHaveLength(24);
    expect(result?.hourly[0].at).toBe(time[24]);
    expect(result?.hourly[23].at).toBe(time[47]);
    const { writeWeatherCache } = await import(
      "@/features/weather/server/weather-cache"
    );
    expect(vi.mocked(writeWeatherCache).mock.lastCall?.[1].hourly).toHaveLength(
      72,
    );
  });

  it("falls back to open-meteo when amap answers OK with empty data", async () => {
    vi.stubEnv("AMAP_API_KEY", "test-amap-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string | Request) => {
        const urlString = typeof url === "string" ? url : url.toString();
        const parsedUrl = new URL(urlString);
        if (parsedUrl.hostname === "restapi.amap.com") {
          // Uncovered adcodes return 200/OK with empty payloads.
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve(
                parsedUrl.searchParams.get("extensions") === "all"
                  ? { forecasts: [{ casts: [] }] }
                  : { lives: [[]] },
              ),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              current: { temperature_2m: 25, weather_code: 0 },
              hourly: { time: [], temperature_2m: [], weather_code: [] },
              daily: {
                time: ["2026-08-28"],
                temperature_2m_max: [30],
                temperature_2m_min: [20],
                weather_code: [1],
              },
            }),
        });
      }),
    );

    const { getWeatherSnapshot } = await import(
      "@/features/weather/server/weather-service"
    );
    const result = await getWeatherSnapshot("ustc-main");
    expect(result).not.toBeNull();
    expect(result?.providers).toEqual(["open-meteo"]);
    expect(result?.current.temperature).toBe(25);
    expect(result?.daily).toHaveLength(1);
  });

  it("returns null when both providers fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    const { getWeatherSnapshot } = await import(
      "@/features/weather/server/weather-service"
    );
    const result = await getWeatherSnapshot("ustc-main");
    expect(result).toBeNull();
  });
});
