import { afterAll, describe, expect, it } from "vitest";
import { writeWeatherHistory } from "@/features/weather/server/weather-history";
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

describe("weather history under deployment runtime grants", () => {
  afterAll(async () => {
    await fixturePrisma.weatherObservation.deleteMany({ where });
    await Promise.all([
      prisma.$disconnect(),
      disconnectTestPrisma(fixturePrisma),
    ]);
  });

  it("persists one hourly snapshot through the real writer and denies runtime deletion", async () => {
    await fixturePrisma.weatherObservation.deleteMany({ where });
    const providerBlobs = { openMeteo: { temperature: 20 } };
    // Exercise the application connection, with no privileged client injection.
    await writeWeatherHistory(snapshot, providerBlobs);
    await writeWeatherHistory(
      { ...snapshot, current: { ...snapshot.current, temperature: 21 } },
      providerBlobs,
    );

    const stored = await fixturePrisma.weatherObservation.findMany({
      where,
      select: { mergedSnapshot: true, providerBlobs: true },
    });
    expect(stored).toEqual([{ mergedSnapshot: snapshot, providerBlobs }]);
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
