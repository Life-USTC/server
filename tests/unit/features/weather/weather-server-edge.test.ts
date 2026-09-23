import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WeatherSnapshot } from "@/features/weather/server/weather-types";
import type { AppPageLoadEvent } from "@/lib/shell/page-load-types";
import { createDeferred } from "../../../shared/deferred";

const mocks = vi.hoisted(() => ({
  getCloudflareWeatherNamespace: vi.fn(),
  weatherObservationUpsert: vi.fn(),
  getWorkspacePageCopy: vi.fn(),
  getWeatherSnapshot: vi.fn(),
}));

vi.mock("@/lib/ports/runtime", () => ({
  getCloudflareWeatherNamespace: mocks.getCloudflareWeatherNamespace,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    weatherObservation: {
      upsert: mocks.weatherObservationUpsert,
    },
  },
}));

vi.mock("@/lib/shell/page-copy", () => ({
  getWorkspacePageCopy: mocks.getWorkspacePageCopy,
}));

vi.mock("@/features/weather/server/weather-service", () => ({
  getWeatherSnapshot: mocks.getWeatherSnapshot,
}));

const snapshot: WeatherSnapshot = {
  location: { key: "ustc-main", name: "本部", adcode: "340100" },
  fetchedAt: "2026-08-28T03:42:19.123Z",
  providers: ["amap", "open-meteo"],
  current: {
    condition: { icon: "sunny", text: "晴" },
    temperature: 28,
  },
  hourly: [],
  daily: [],
  alerts: [],
  extensions: { amap: { raw: true } },
};

describe("weather server edges", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCloudflareWeatherNamespace.mockReturnValue(undefined);
    mocks.weatherObservationUpsert.mockResolvedValue({});
    mocks.getWorkspacePageCopy.mockReturnValue({ weather: { title: "天气" } });
    mocks.getWeatherSnapshot.mockImplementation(async (locationKey: string) =>
      locationKey === "ustc-main" ? snapshot : null,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses a versioned cache key and safely no-ops when the binding is absent", async () => {
    const { buildWeatherCacheKey, readWeatherCache, writeWeatherCache } =
      await import("@/features/weather/server/weather-cache");

    expect(buildWeatherCacheKey("ustc-main")).toBe("weather:ustc-main:v2");
    await expect(readWeatherCache("ustc-main")).resolves.toBeNull();
    await expect(
      writeWeatherCache("ustc-main", snapshot),
    ).resolves.toBeUndefined();
  });

  it("reads and writes JSON snapshots with separate cache lifetimes", async () => {
    const namespace = {
      get: vi.fn().mockResolvedValue(snapshot),
      put: vi.fn().mockResolvedValue(undefined),
    };
    mocks.getCloudflareWeatherNamespace.mockReturnValue(namespace);

    const { readWeatherCache, writeWeatherCache } = await import(
      "@/features/weather/server/weather-cache"
    );

    await expect(readWeatherCache("ustc-main")).resolves.toBe(snapshot);
    expect(namespace.get).toHaveBeenCalledWith("weather:ustc-main:v2", {
      cacheTtl: 900,
      type: "json",
    });

    await writeWeatherCache("ustc-main", snapshot);
    expect(namespace.put).toHaveBeenCalledWith(
      "weather:ustc-main:v2",
      JSON.stringify(snapshot),
      { expirationTtl: 3600 },
    );
  });

  it("upserts one hourly observation using the fetched timestamp hour", async () => {
    const { writeWeatherHistory } = await import(
      "@/features/weather/server/weather-history"
    );
    const providerBlobs = {
      amap: { lives: [{ temperature: "28" }] },
      openMeteo: undefined,
    };

    await writeWeatherHistory(snapshot, providerBlobs);

    expect(mocks.weatherObservationUpsert).toHaveBeenCalledWith({
      where: {
        locationKey_observedAt: {
          locationKey: "ustc-main",
          observedAt: new Date("2026-08-28T03:00:00.000Z"),
        },
      },
      update: {},
      create: {
        locationKey: "ustc-main",
        observedAt: new Date("2026-08-28T03:00:00.000Z"),
        providerBlobs,
        mergedSnapshot: snapshot,
      },
    });
  });

  it("loads both campus locations in parallel and preserves missing snapshots", async () => {
    const { loadWeatherPage } = await import(
      "@/features/weather/server/weather-page-load"
    );
    const mainSnapshot = createDeferred<WeatherSnapshot>();
    const gaoxinSnapshot = createDeferred<WeatherSnapshot | null>();
    const started: string[] = [];
    mocks.getWeatherSnapshot.mockImplementation((locationKey: string) => {
      started.push(locationKey);
      return locationKey === "ustc-main"
        ? mainSnapshot.promise
        : gaoxinSnapshot.promise;
    });
    const event = {
      locals: { locale: "en-us" },
      request: new Request("https://life.example/catalog/weather"),
      url: new URL("https://life.example/catalog/weather"),
    } satisfies AppPageLoadEvent;

    let pageSettled = false;
    const page = loadWeatherPage(event).then((result) => {
      pageSettled = true;
      return result;
    });
    expect(started).toEqual(["ustc-main", "ustc-gaoxin"]);
    expect(pageSettled).toBe(false);
    mainSnapshot.resolve(snapshot);
    expect(pageSettled).toBe(false);
    gaoxinSnapshot.resolve(null);

    await expect(page).resolves.toEqual({
      copy: { weather: { title: "天气" } },
      locale: "en-us",
      locations: [
        { locationKey: "ustc-main", snapshot },
        { locationKey: "ustc-gaoxin", snapshot: null },
      ],
    });
    expect(mocks.getWorkspacePageCopy).toHaveBeenCalledWith("en-us");
    expect(mocks.getWeatherSnapshot).toHaveBeenCalledTimes(2);
    expect(mocks.getWeatherSnapshot).toHaveBeenCalledWith("ustc-main");
    expect(mocks.getWeatherSnapshot).toHaveBeenCalledWith("ustc-gaoxin");
  });
});
