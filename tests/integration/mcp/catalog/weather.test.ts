import { describe, test, vi } from "vitest";
import { mergeWeatherSnapshots } from "@/features/weather/server/weather-merge";
import type { WeatherSnapshot } from "@/features/weather/server/weather-types";
import { getWeatherLocation } from "@/features/weather/server/weather-types";
import { getWeatherRoute } from "@/lib/api/routes/weather";
import { weatherSnapshotResponseSchema } from "@/lib/api/schemas/weather-response-schemas";
import { createGraphqlYoga } from "@/lib/graphql/server";
import { createNodeRuntime } from "../../../shared/node-runtime";
import { ownAnonymousMcpHarness } from "../_harness/client";

const weatherContext = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  return new AsyncLocalStorage<{
    readCache: (key: string) => Promise<WeatherSnapshot>;
    calls: string[];
  }>();
});

const contractTest = test
  .extend(
    "requestRuntime",
    // biome-ignore lint/correctness/noEmptyPattern: Vitest parses fixture dependencies.
    ({}, { onCleanup }) => {
      const runtime = createNodeRuntime({
        APP_PUBLIC_ORIGIN: "https://example.test",
        APP_CANONICAL_ORIGIN: "https://example.test",
      });
      onCleanup(() => runtime.close());
      return runtime;
    },
  )
  .extend("anonymousSession", ({ requestRuntime }, { onCleanup }) => {
    const session = ownAnonymousMcpHarness(requestRuntime);
    onCleanup(() => session.client.close());
    return session;
  })
  .extend("state", async ({ anonymousSession, requestRuntime }) => {
    const mocks = {
      readCache: async (key: string) => snapshot(key),
      calls: [] as string[],
    };
    function snapshot(key: string): WeatherSnapshot {
      return {
        location: {
          key: key as WeatherSnapshot["location"]["key"],
          name: key,
          adcode: "340100",
        },
        fetchedAt: new Date().toISOString(),
        providers: ["amap"],
        current: { temperature: 20, condition: { text: "晴", icon: "sunny" } },
        hourly: [],
        daily: [],
        alerts: [],
        extensions: {},
      };
    }
    async function graphql(locationKey: string) {
      const response = await requestRuntime.run(() =>
        createGraphqlYoga(false).fetch(
          "https://example.test/api/graphql",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              query:
                "query($key: String!) { catalog { weather(locationKey: $key) { location { key } current { temperature } } } }",
              variables: { key: locationKey },
            }),
          },
          { locals: { locale: "zh-cn" }, principal: { kind: "anonymous" } },
        ),
      );
      return response.json();
    }
    await anonymousSession.initialize();

    return {
      mocks,
      client: anonymousSession.client,
      snapshot,
      graphql,
      request: requestRuntime.run,
    };
  });

vi.mock("@/features/weather/server/weather-cache", () => ({
  readWeatherCache: (key: string) => {
    const mocks = weatherContext.getStore();
    if (!mocks) throw new Error("Weather call outside its test fixture");
    mocks.calls.push(key);
    return mocks.readCache(key);
  },
}));

contractTest.aroundEach(async (runTest, { state }) => {
  await weatherContext.run(state.mocks, runTest);
});

describe("weather transport contracts", () => {
  contractTest("weather.public-no-signin", async ({ state, expect }) => {
    const { mocks, client, snapshot, graphql, request } = state;

    for (const [key, temperature] of [
      ["ustc-main", 20],
      ["ustc-gaoxin", null],
    ] as const) {
      mocks.readCache = async (locationKey: string) => ({
        ...snapshot(locationKey),
        current: { temperature, condition: { text: "未知", icon: "unknown" } },
      });
      const response = await request(() =>
        getWeatherRoute(
          new Request(
            `https://example.test/api/catalog/weather?locationKey=${key}`,
          ),
        ),
      );
      expect(response.status).toBe(200);
      const rest = await response.json();
      expect(weatherSnapshotResponseSchema.safeParse(rest).success).toBe(true);
      expect(rest).toMatchObject({
        location: { key },
        current: { temperature },
      });
      const result = await graphql(key);
      expect(result.errors).toBeUndefined();
      expect(result.data.catalog.weather).toEqual({
        location: { key },
        current: { temperature },
      });
      expect(
        await client.callTool("catalog_weather_get", { locationKey: key }),
      ).toMatchObject({ location: { key }, current: { temperature } });
    }
  });
  contractTest("weather.location-key-boundary", async ({ state, expect }) => {
    const { mocks, client, graphql, request } = state;

    for (const key of ["", "unknown", "USTC-MAIN", " ustc-main "]) {
      mocks.calls.length = 0;
      const response = await request(() =>
        getWeatherRoute(
          new Request(
            `https://example.test/api/catalog/weather?locationKey=${encodeURIComponent(key)}`,
          ),
        ),
      );
      expect(response.status).toBe(400);
      const result = await graphql(key);
      expect(result.errors?.[0].extensions.code).toBe("BAD_USER_INPUT");
      expect(
        (
          await client.callToolResult("catalog_weather_get", {
            locationKey: key,
          })
        ).isError,
      ).toBe(true);
      expect(mocks.calls).toEqual([]);
    }
  });
});

contractTest("weather.raw-extensions-preserved", async ({ state, expect }) => {
  const { mocks, client, request } = state;

  const amapRaw = {
    base: { status: "1", lives: [{ temperature: "22", humidity: "71" }] },
    all: { status: "1", forecasts: [] },
    futureProviderField: { source: "station", flags: [1, true, null] },
  };
  const meteoRaw = {
    latitude: 31.826,
    longitude: 117.27,
    current: { temperature_2m: 21 },
    units: { temperature: "°C" },
    futureProviderField: ["observation", { quality: 0.8 }],
  };
  for (const locationKey of ["ustc-main", "ustc-gaoxin"] as const) {
    const merged = mergeWeatherSnapshots(
      getWeatherLocation(locationKey),
      {
        ok: true,
        data: { current: { temperature: 22, weather: "晴" } },
        raw: amapRaw,
      },
      {
        ok: true,
        data: { current: { temperature_2m: 21, weather_code: 0 } },
        raw: meteoRaw,
      },
    );
    mocks.readCache = async () => merged;
    const response = await request(() =>
      getWeatherRoute(
        new Request(
          `https://example.test/api/catalog/weather?locationKey=${locationKey}`,
        ),
      ),
    );
    expect(response.status).toBe(200);
    const rest = await response.json();
    expect(rest.current.temperature).toBe(22);
    expect(rest.extensions).toEqual({ amap: amapRaw, openMeteo: meteoRaw });
    const full = await client.call("catalog_weather_get", {
      locationKey,
      mode: "full",
    });
    expect(full).toMatchObject({
      current: { temperature: 22 },
      extensions: rest.extensions,
    });
    const compact = await client.call("catalog_weather_get", {
      locationKey,
      mode: "default",
    });
    expect(compact).not.toHaveProperty("extensions");
    expect(compact).toMatchObject({ current: { temperature: 22 } });
  }
});
