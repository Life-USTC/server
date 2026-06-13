import {
  checksumBusPayload,
  inferBusEffectiveFrom,
  inferBusVersionKey,
  inferBusVersionTitle,
} from "./bus-import-metadata";
import type { BusImportOptions } from "./bus-import-options";
import type { BusImportPrisma } from "./bus-import-prisma";
import {
  disablePreviousBusScheduleVersions,
  findExistingBusScheduleVersion,
  refreshExistingBusScheduleVersion,
  upsertImportedBusScheduleVersion,
} from "./bus-import-version-upsert";
import {
  assertBusRouteConsistency,
  createBusTripsForDayType,
  upsertBusCampuses,
  upsertBusRoutes,
} from "./bus-import-writes";
import type { BusImportResult, BusStaticPayload } from "./bus-types";

export async function importBusStaticPayload(
  prisma: BusImportPrisma,
  payload: BusStaticPayload,
  options?: BusImportOptions,
): Promise<BusImportResult> {
  assertBusRouteConsistency(payload);

  const checksum = await checksumBusPayload(payload);
  const versionKey = inferBusVersionKey(payload, options?.versionKey);
  const versionTitle = inferBusVersionTitle(payload, options?.versionTitle);
  const effectiveFrom = inferBusEffectiveFrom(payload, options?.effectiveFrom);
  const effectiveUntil = options?.effectiveUntil ?? null;

  const existing = await findExistingBusScheduleVersion(prisma, {
    checksum,
    versionKey,
  });

  if (existing) {
    await refreshExistingBusScheduleVersion(prisma, {
      checksum,
      effectiveFrom,
      effectiveUntil,
      existingId: existing.id,
      payload,
      versionKey,
      versionTitle,
    });
  }

  if (options?.disablePreviousVersions !== false) {
    await disablePreviousBusScheduleVersions(prisma, {
      existingId: existing?.id,
      versionKey,
    });
  }

  await upsertBusCampuses(prisma, payload);
  await upsertBusRoutes(prisma, payload);

  const version = await upsertImportedBusScheduleVersion(prisma, {
    checksum,
    effectiveFrom,
    effectiveUntil,
    existingId: existing?.id,
    payload,
    versionKey,
    versionTitle,
  });

  const [weekdayTrips, weekendTrips] = await Promise.all([
    createBusTripsForDayType(
      prisma,
      version.id,
      "weekday",
      payload.weekday_routes,
    ),
    createBusTripsForDayType(
      prisma,
      version.id,
      "weekend",
      payload.weekend_routes,
    ),
  ]);

  return {
    versionId: version.id,
    versionKey: version.key,
    campuses: payload.campuses.length,
    routes: payload.routes.length,
    trips: weekdayTrips + weekendTrips,
  };
}
