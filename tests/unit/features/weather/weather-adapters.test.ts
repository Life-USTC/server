import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAmapWeather } from "@/features/weather/server/amap-adapter";
import {
  fetchOpenMeteoWeather,
  normalizeOpenMeteoCondition,
} from "@/features/weather/server/open-meteo-adapter";
import { getWeatherLocation } from "@/features/weather/server/weather-types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

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

  it("weather.location-provider-mapping", async () => {
    vi.stubEnv("AMAP_API_KEY", "test-key");
    const requests: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        requests.push(url);
        return Response.json(
          url.hostname === "restapi.amap.com"
            ? { lives: [{ weather: "晴", temperature: "20" }], forecasts: [] }
            : {
                current: { temperature_2m: 20, weather_code: 0 },
                hourly: {
                  time: ["2026-09-15T08:00"],
                  temperature_2m: [20],
                  weather_code: [0],
                },
              },
        );
      }),
    );
    for (const [key, adcode, latitude, longitude] of [
      ["ustc-main", "340100", "31.826", "117.27"],
      ["ustc-gaoxin", "340104", "31.839", "117.094"],
    ]) {
      requests.length = 0;
      const location = getWeatherLocation(key);
      if (!location) throw new Error("Missing campus mapping");
      expect((await fetchAmapWeather(location)).ok).toBe(true);
      const openMeteo = await fetchOpenMeteoWeather(location);
      expect(openMeteo.ok).toBe(true);
      expect(requests).toHaveLength(3);
      expect(
        requests
          .slice(0, 2)
          .map((url) => [
            url.searchParams.get("city"),
            url.searchParams.get("extensions"),
          ]),
      ).toEqual([
        [adcode, "base"],
        [adcode, "all"],
      ]);
      expect(requests[2].searchParams.get("latitude")).toBe(latitude);
      expect(requests[2].searchParams.get("longitude")).toBe(longitude);
      expect(requests[2].searchParams.get("timezone")).toBe("Asia/Shanghai");
      if (!openMeteo.ok) throw openMeteo.error;
      expect(openMeteo.data.hourly?.time).toEqual([
        "2026-09-15T08:00:00+08:00",
      ]);
    }
  });
});
