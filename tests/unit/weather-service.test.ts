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
  });

  it("returns null for unknown location", async () => {
    const { getWeatherSnapshot } = await import(
      "@/features/weather/server/weather-service"
    );
    const result = await getWeatherSnapshot("unknown");
    expect(result).toBeNull();
  });

  it("merges provider results", async () => {
    vi.stubEnv("AMAP_API_KEY", "test-amap-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string | Request) => {
        const urlString = typeof url === "string" ? url : url.toString();
        if (urlString.includes("amap.com")) {
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
              current: {
                temperature_2m: 25,
                weather_code: 0,
              },
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
