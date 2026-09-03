import {
  checksumBusPayload,
  inferBusEffectiveFrom,
  inferBusVersionKey,
  inferBusVersionTitle,
} from "../lib/bus-import-metadata";
import type { BusImportOptions } from "../lib/bus-import-options";
import type { BusImportResult, BusStaticPayload } from "../lib/bus-types";
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

export type BusImportStage =
  | "find-existing-version"
  | "refresh-existing-version"
  | "disable-previous-versions"
  | "upsert-campuses"
  | "upsert-routes"
  | "upsert-version"
  | "create-weekday-trips"
  | "create-saturday-trips"
  | "create-sunday-trips";

export class BusImportStageError extends Error {
  readonly stage: BusImportStage;

  constructor(stage: BusImportStage, cause: unknown) {
    const detail = cause instanceof Error ? `: ${cause.message}` : "";
    super(`Bus import failed at ${stage}${detail}`, { cause });
    this.name = "BusImportStageError";
    this.stage = stage;
  }
}

export function getBusImportFailureStage(error: unknown) {
  return error instanceof BusImportStageError ? error.stage : undefined;
}

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

  return prisma.$transaction(async (tx) => {
    let stage: BusImportStage = "find-existing-version";
    try {
      const existing = await findExistingBusScheduleVersion(tx, {
        checksum,
        versionKey,
      });

      if (existing) {
        stage = "refresh-existing-version";
        await refreshExistingBusScheduleVersion(tx, {
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
        stage = "disable-previous-versions";
        await disablePreviousBusScheduleVersions(tx, {
          existingId: existing?.id,
          versionKey,
        });
      }

      stage = "upsert-campuses";
      await upsertBusCampuses(tx, payload);
      stage = "upsert-routes";
      await upsertBusRoutes(tx, payload);

      stage = "upsert-version";
      const version = await upsertImportedBusScheduleVersion(tx, {
        checksum,
        effectiveFrom,
        effectiveUntil,
        existingId: existing?.id,
        payload,
        versionKey,
        versionTitle,
      });

      stage = "create-weekday-trips";
      const weekdayTrips = await createBusTripsForDayType(
        tx,
        version.id,
        "weekday",
        payload.weekday_routes,
      );
      stage = "create-saturday-trips";
      const saturdayTrips = await createBusTripsForDayType(
        tx,
        version.id,
        "saturday",
        payload.saturday_routes,
      );
      stage = "create-sunday-trips";
      const sundayTrips = await createBusTripsForDayType(
        tx,
        version.id,
        "sunday",
        payload.sunday_routes,
      );

      return {
        versionId: version.id,
        versionKey: version.key,
        campuses: payload.campuses.length,
        routes: payload.routes.length,
        trips: weekdayTrips + saturdayTrips + sundayTrips,
      };
    } catch (error) {
      throw new BusImportStageError(stage, error);
    }
  });
}
