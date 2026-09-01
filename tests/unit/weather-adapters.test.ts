import { describe, expect, it, vi } from "vitest";
import { fetchAmapWeather } from "@/features/weather/server/amap-adapter";
import {
  fetchOpenMeteoWeather,
  normalizeOpenMeteoCondition,
} from "@/features/weather/server/open-meteo-adapter";
import { getWeatherLocation } from "@/features/weather/server/weather-types";

describe("weather adapters", () => {
  it("returns error when AMAP_API_KEY is missing", async () => {
    vi.stubEnv("AMAP_API_KEY", "");
    const location = getWeatherLocation("ustc-main");
    const result = await fetchAmapWeather(location);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("AMAP_API_KEY");
    }
  });

  it("parses Open-Meteo condition codes", () => {
    expect(normalizeOpenMeteoCondition(0).text).toBe("晴");
    expect(normalizeOpenMeteoCondition(95).text).toBe("雷雨");
    expect(normalizeOpenMeteoCondition(999).text).toBe("未知");
  });

  it("fetches AMap base and all sequentially to stay under the QPS limit", async () => {
    vi.stubEnv("AMAP_API_KEY", "test-key");
    const order: string[] = [];
    let resolveBase!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("extensions=base")) {
          order.push("base:start");
          return new Promise<Response>((resolve) => {
            resolveBase = resolve;
          });
        }
        order.push("all:start");
        return Promise.resolve(
          new Response(JSON.stringify({ status: "1", forecasts: [] })),
        );
      }),
    );

    const pending = fetchAmapWeather(getWeatherLocation("ustc-main"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(["base:start"]);

    resolveBase(
      new Response(
        JSON.stringify({
          status: "1",
          lives: [{ weather: "阴", temperature: "27" }],
        }),
      ),
    );
    const result = await pending;
    expect(order).toEqual(["base:start", "all:start"]);
    expect(result.ok).toBe(true);

    vi.unstubAllGlobals();
  });

  it("fetches Open-Meteo weather for ustc-gaoxin", async () => {
    const location = getWeatherLocation("ustc-gaoxin");
    const result = await fetchOpenMeteoWeather(location);
    // Allow network failures in CI/test environments; verify shape on success.
    if (result.ok) {
      expect(result.data.current).toBeDefined();
      expect(result.data.daily).toBeDefined();
      expect(result.data.hourly).toBeDefined();
    }
  });
});
