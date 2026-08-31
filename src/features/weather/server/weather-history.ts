import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { WeatherSnapshot } from "./weather-types";

function floorToHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

export async function writeWeatherHistory(
  snapshot: WeatherSnapshot,
  providerBlobs: { amap?: unknown; openMeteo?: unknown },
): Promise<void> {
  const observedAt = floorToHour(new Date(snapshot.fetchedAt));
  await prisma.weatherObservation.upsert({
    where: {
      locationKey_observedAt: {
        locationKey: snapshot.location.key,
        observedAt,
      },
    },
    update: {},
    create: {
      locationKey: snapshot.location.key,
      observedAt,
      providerBlobs: providerBlobs as Prisma.InputJsonValue,
      mergedSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
}
