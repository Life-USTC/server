import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { refreshWeatherSnapshot } from "@/features/weather/server/weather-service";
import type { WeatherSnapshot } from "@/features/weather/server/weather-types";
import { prisma } from "@/lib/db/prisma";
import { createFixturePrisma, disconnectTestPrisma } from "../shared/prisma";

const fixturePrisma = createFixturePrisma();
const observedAt = new Date("2035-01-01T03:00:00.000Z");
const snapshot: WeatherSnapshot = {
  location: { key: "ustc-main", name: "Test campus", adcode: "340100" },
  fetchedAt: "2035-01-01T03:24:00.000Z",
  providers: ["open-meteo"],
  current: { temperature: 20, condition: { text: "Clear", icon: "clear" } },
  hourly: [],
  daily: [],
  alerts: [],
  extensions: {},
};
const where = { locationKey: snapshot.location.key, observedAt };

vi.mock("@/features/weather/server/weather-cache", () => ({
  writeWeatherCache: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("weather history under deployment runtime grants", () => {
  afterAll(async () => {
    await fixturePrisma.weatherObservation.deleteMany({ where });
    await Promise.all([
      prisma.$disconnect(),
      disconnectTestPrisma(fixturePrisma),
    ]);
  });

  it("weather.weather-observation-history", async () => {
    await fixturePrisma.weatherObservation.deleteMany({ where });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(snapshot.fetchedAt));
    vi.stubEnv("AMAP_API_KEY", "");
    let temperature = 20;
    const raw = () => ({
      current: { temperature_2m: temperature, weather_code: 0 },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(raw())),
    );
    const providerBlobs = { openMeteo: raw() };
    const first = await refreshWeatherSnapshot("ustc-main");
    expect(first?.current.temperature).toBe(20);
    temperature = 21;
    const second = await refreshWeatherSnapshot("ustc-main");
    expect(second?.current.temperature).toBe(21);

    const stored = await fixturePrisma.weatherObservation.findMany({
      where,
      select: { mergedSnapshot: true, providerBlobs: true },
    });
    expect(stored).toEqual([{ mergedSnapshot: first, providerBlobs }]);
    await expect(
      prisma.weatherObservation.findMany({ where }),
    ).resolves.toHaveLength(1);
    await expect(
      prisma.weatherObservation.deleteMany({ where }),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      fixturePrisma.weatherObservation.count({ where }),
    ).resolves.toBe(1);
  });
});
