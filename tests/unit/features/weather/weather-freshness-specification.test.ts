import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readSpecification } from "../../../../scripts/specifications/yaml";
import { semanticContract } from "../../../shared/specifications/semantic-contract";

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

it("weather.cache-and-history", async (context) => {
  const contract = await semanticContract(context.task.name, "cache_freshness");
  contract.equal("/surface", "service");
  contract.equal("/operation", getWeatherSnapshot.name);
  contract.equal("/timestamp", "fetchedAt");
  const document = await readSpecification<{
    requirements: {
      id: string;
      expectation?: {
        kind: "cache_freshness";
        max_age_seconds: number;
        expires_at_boundary: boolean;
        invalid_timestamps: "refresh";
        future_timestamps: "refresh";
        refresh_failure: "unavailable";
      };
    }[];
  }>("docs/features/weather.yaml");
  const rule = document.requirements.find(
    (r) => r.id === "weather.cache-and-history",
  )?.expectation;
  if (rule?.kind !== "cache_freshness")
    throw new Error("Missing weather freshness expectation");
  const maxAge = rule.max_age_seconds * 1000;
  for (const age of [0, maxAge - 1, maxAge, maxAge + 1]) {
    mocks.amap.mockClear();
    mocks.openMeteo.mockClear();
    mocks.readCache.mockResolvedValue(
      cached(new Date(reference.getTime() - age).toISOString()),
    );
    const result = await getWeatherSnapshot("ustc-main");
    const expired = rule.expires_at_boundary ? age >= maxAge : age > maxAge;
    expect(mocks.openMeteo).toHaveBeenCalledTimes(expired ? 1 : 0);
    expect(mocks.amap).toHaveBeenCalledTimes(expired ? 1 : 0);
    expect(result?.current.temperature).toBe(expired ? 23 : 12);
    if (age === maxAge)
      contract.equal(
        "/expires_at_boundary",
        mocks.openMeteo.mock.calls.length === 1,
      );
    // Both adjacent probes must agree before the observed expiry is recorded.
    if (age === maxAge - 1) expect(mocks.openMeteo).not.toHaveBeenCalled();
    if (age === maxAge + 1) {
      expect(mocks.openMeteo).toHaveBeenCalledOnce();
      contract.equal("/max_age_seconds", (age - 1) / 1000);
    }
  }
  for (const [timestamp, policy, field] of [
    ["invalid", rule.invalid_timestamps, "invalid_timestamps"],
    [
      new Date(reference.getTime() + 1).toISOString(),
      rule.future_timestamps,
      "future_timestamps",
    ],
  ]) {
    if (policy !== "refresh") throw new Error("Unsupported timestamp policy");
    mocks.openMeteo.mockClear();
    mocks.readCache.mockResolvedValue(cached(timestamp));
    expect((await getWeatherSnapshot("ustc-main"))?.current.temperature).toBe(
      23,
    );
    expect(mocks.openMeteo).toHaveBeenCalledOnce();
    contract.equal(
      `/${field}`,
      mocks.openMeteo.mock.calls.length === 1 ? "refresh" : "cache",
    );
  }
  mocks.readCache.mockResolvedValue(
    cached(new Date(reference.getTime() - maxAge - 1).toISOString()),
  );
  mocks.openMeteo.mockResolvedValue({
    ok: false,
    error: new Error("unavailable"),
  });
  if (rule.refresh_failure !== "unavailable")
    throw new Error("Unsupported refresh failure policy");
  contract.equal(
    "/refresh_failure",
    (await getWeatherSnapshot("ustc-main")) === null ? "unavailable" : "cached",
  );
  contract.recordVitest(context);
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
