import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readCache: vi.fn(),
  writeCache: vi.fn(),
  writeHistory: vi.fn(),
  amap: vi.fn(),
  openMeteo: vi.fn(),
}));
vi.mock("@/features/weather/server/weather-cache", () => ({
  readWeatherCache: mocks.readCache,
  writeWeatherCache: mocks.writeCache,
}));
vi.mock("@/features/weather/server/weather-history", () => ({
  writeWeatherHistory: mocks.writeHistory,
}));
vi.mock("@/features/weather/server/amap-adapter", async (original) => ({
  ...(await original<
    typeof import("@/features/weather/server/amap-adapter")
  >()),
  fetchAmapWeather: mocks.amap,
}));
vi.mock("@/features/weather/server/open-meteo-adapter", async (original) => ({
  ...(await original<
    typeof import("@/features/weather/server/open-meteo-adapter")
  >()),
  fetchOpenMeteoWeather: mocks.openMeteo,
}));

import { getWeatherSnapshot } from "@/features/weather/server/weather-service";

const reference = new Date("2026-09-15T16:00:00+08:00");
function cached(fetchedAt: string) {
  return {
    location: { key: "ustc-main", name: "本部", adcode: "340100" },
    fetchedAt,
    providers: ["amap"],
    current: { temperature: 12, condition: { text: "晴", icon: "sunny" } },
    hourly: [],
    daily: [],
    alerts: [],
    extensions: {},
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(reference);
  mocks.amap.mockResolvedValue({ ok: false, error: new Error("unavailable") });
  mocks.openMeteo.mockResolvedValue({
    ok: true,
    raw: {},
    data: {
      current: { temperature_2m: 23, weather_code: 0 },
      hourly: { time: [], temperature_2m: [] },
    },
  });
});
afterEach(() => vi.useRealTimers());

it.each([
  { name: "just fetched", age: 0, providerCalls: 0, temperature: 12 },
  {
    name: "one millisecond before expiry",
    age: 899_999,
    providerCalls: 0,
    temperature: 12,
  },
  {
    name: "exactly fifteen minutes old",
    age: 900_000,
    providerCalls: 1,
    temperature: 23,
  },
  {
    name: "one millisecond after expiry",
    age: 900_001,
    providerCalls: 1,
    temperature: 23,
  },
])("weather cache: $name", async ({ age, providerCalls, temperature }) => {
  mocks.readCache.mockResolvedValue(
    cached(new Date(reference.getTime() - age).toISOString()),
  );
  const result = await getWeatherSnapshot("ustc-main");
  expect(mocks.openMeteo).toHaveBeenCalledTimes(providerCalls);
  expect(mocks.amap).toHaveBeenCalledTimes(providerCalls);
  expect(result?.current.temperature).toBe(temperature);
});

it.each([
  { name: "invalid", timestamp: "invalid" },
  {
    name: "in the future",
    timestamp: new Date(reference.getTime() + 1).toISOString(),
  },
])("refreshes a cache whose fetchedAt is $name", async ({ timestamp }) => {
  mocks.readCache.mockResolvedValue(cached(timestamp));
  expect((await getWeatherSnapshot("ustc-main"))?.current.temperature).toBe(23);
  expect(mocks.openMeteo).toHaveBeenCalledOnce();
  expect(mocks.amap).toHaveBeenCalledOnce();
});

it("returns unavailable when an expired cache cannot be refreshed", async () => {
  mocks.readCache.mockResolvedValue(
    cached(new Date(reference.getTime() - 900_001).toISOString()),
  );
  mocks.openMeteo.mockResolvedValue({
    ok: false,
    error: new Error("unavailable"),
  });
  expect(await getWeatherSnapshot("ustc-main")).toBeNull();
  expect(mocks.amap).toHaveBeenCalledOnce();
  expect(mocks.openMeteo).toHaveBeenCalledOnce();
});

it("weather.hourly-forecast-expiry", async () => {
  const snapshot = {
    ...cached(reference.toISOString()),
    hourly: [
      { at: new Date(reference.getTime() - 1).toISOString(), temperature: 10 },
    ],
  };
  mocks.readCache.mockResolvedValue(snapshot);
  expect((await getWeatherSnapshot("ustc-main"))?.hourly).toEqual([]);
  mocks.readCache.mockResolvedValue({ ...snapshot, hourly: [] });
  expect((await getWeatherSnapshot("ustc-main"))?.hourly).toEqual([]);
  expect(mocks.openMeteo).not.toHaveBeenCalled();
});
