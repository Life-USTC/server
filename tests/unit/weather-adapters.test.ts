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
    const location = getWeatherLocation("ustc-main")!;
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

  it("fetches Open-Meteo weather for ustc-gaoxin", async () => {
    const location = getWeatherLocation("ustc-gaoxin")!;
    const result = await fetchOpenMeteoWeather(location);
    // Allow network failures in CI/test environments; verify shape on success.
    if (result.ok) {
      expect(result.data.current).toBeDefined();
      expect(result.data.daily).toBeDefined();
      expect(result.data.hourly).toBeDefined();
    }
  });
});
