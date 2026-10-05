import { describe, vi } from "vitest";
import { readWeatherCache } from "@/features/weather/server/weather-cache";
import { refreshWeatherSnapshot } from "@/features/weather/server/weather-service";
import { prisma } from "@/lib/db/prisma";
import { getCloudflareWeatherNamespace } from "@/lib/ports/runtime";
import { isolatedDatabaseTest } from "../shared/isolated-database";
import { createNodeRuntime } from "../shared/node-runtime";

const test = isolatedDatabaseTest.extend<{
  weather: {
    run: ReturnType<typeof createNodeRuntime>["run"];
    provider: { temperature: number };
  };
}>({
  weather: async ({ isolatedDatabase, onTestFinished }, use) => {
    const runtime = createNodeRuntime({
      HYPERDRIVE: { connectionString: isolatedDatabase.connections.app },
      // Override only this runtime; never mutate the process environment.
      AMAP_API_KEY: "",
    });
    const provider = { temperature: 20 };
    let restoreFetch: (() => void) | undefined;
    try {
      const fetchMock = vi.spyOn(globalThis, "fetch");
      restoreFetch = () => fetchMock.mockRestore();
      fetchMock.mockImplementation(async (input) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.origin !== "https://api.open-meteo.com")
          throw new Error("Unexpected weather provider request");
        return Response.json({
          current: { temperature_2m: provider.temperature, weather_code: 0 },
        });
      });
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2035-01-01T03:24:00.000Z"));
      await use({ run: runtime.run, provider });
    } finally {
      // A native timeout can end use before the admitted body settles. Its
      // provider and clock must remain available until all runtime work joins.
      const failures: unknown[] = [];
      try {
        await runtime.close();
      } catch (error) {
        failures.push(error);
      }
      try {
        restoreFetch?.();
      } catch (error) {
        failures.push(error);
      }
      try {
        vi.useRealTimers();
      } catch (error) {
        failures.push(error);
      }
      if (failures.length) {
        // Actual cleanup is finished. Let outer database owners dispose before
        // reporting every original close/restoration failure exactly once.
        onTestFinished(() => {
          if (failures.length === 1) throw failures[0];
          throw new AggregateError(failures, "Weather runtime cleanup failed");
        });
      }
    }
  },
});

// Date/fetch are process globals. This file has one case; overlapping copies
// require separate native processes, even though each database is private.
describe("weather history under deployment runtime grants", () => {
  test("weather.weather-observation-history", {
    tags: ["@Weather/Service"],
  }, async ({ weather, isolatedDatabase, expect }) => {
    await weather.run(async () => {
      const fixturePrisma = isolatedDatabase.owner;
      const where = {
        locationKey: "ustc-main",
        observedAt: new Date("2035-01-01T03:00:00.000Z"),
      };
      const providerBlobs = {
        openMeteo: { current: { temperature_2m: 20, weather_code: 0 } },
      };
      expect(getCloudflareWeatherNamespace()).toBeUndefined();
      const first = await refreshWeatherSnapshot("ustc-main");
      expect(first?.current.temperature).toBe(20);
      weather.provider.temperature = 21;
      const second = await refreshWeatherSnapshot("ustc-main");
      expect(second?.current.temperature).toBe(21);
      // Exercise the actual no-binding cache branch after both real refreshes.
      await expect(readWeatherCache("ustc-main")).resolves.toBeNull();

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
});
