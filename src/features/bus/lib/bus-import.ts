import { createHash } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import type {
  BusImportResult,
  BusStaticCampus,
  BusStaticPayload,
  BusStaticRouteSchedule,
} from "./bus-types";

const SEASON_START_MONTH = {
  春: 2,
  夏: 6,
  秋: 9,
  冬: 12,
} as const;

function checksumPayload(payload: BusStaticPayload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function inferVersionKey(
  payload: BusStaticPayload,
  explicitKey?: string | null,
) {
  if (explicitKey?.trim()) {
    return explicitKey.trim();
  }

  const message = payload.message?.message?.trim();
  const yearSeason = message?.match(/(\d{4})\s*([春夏秋冬])/);
  if (yearSeason) {
    return `static-bus-${yearSeason[1]}-${yearSeason[2]}`;
  }

  return `static-bus-${new Date().toISOString().slice(0, 10)}`;
}

function inferVersionTitle(
  payload: BusStaticPayload,
  explicitTitle?: string | null,
) {
  if (explicitTitle?.trim()) {
    return explicitTitle.trim();
  }
  return payload.message?.message?.trim() || "Life@USTC 校车时刻表";
}

function inferEffectiveFrom(
  payload: BusStaticPayload,
  explicitEffectiveFrom?: Date | null,
) {
  if (explicitEffectiveFrom) return explicitEffectiveFrom;

  const message = payload.message?.message?.trim();
  const yearSeason = message?.match(/(\d{4})\s*([春夏秋冬])/);
  if (!yearSeason) return null;

  const year = Number(yearSeason[1]);
  const season = yearSeason[2] as keyof typeof SEASON_START_MONTH;
  const month = SEASON_START_MONTH[season];

  return new Date(Date.UTC(year, month - 1, 1));
}

function normalizeCampusName(name: string) {
  return name.trim();
}

function buildRouteEnglishName(campuses: BusStaticCampus[]) {
  const start = campuses[0]?.name ?? "";
  const end = campuses[campuses.length - 1]?.name ?? "";
  return start && end ? `${start} to ${end}` : null;
}

function assertRouteConsistency(payload: BusStaticPayload) {
  const routeIds = new Set(payload.routes.map((route) => route.id));
  for (const schedule of [
    ...payload.weekday_routes,
    ...payload.weekend_routes,
  ]) {
    if (!routeIds.has(schedule.route.id)) {
      throw new Error(
        `Unknown route id ${schedule.route.id} in schedule table`,
      );
    }
  }
}

async function upsertCampuses(prisma: PrismaClient, payload: BusStaticPayload) {
  for (const campus of payload.campuses) {
    await prisma.busCampus.upsert({
      where: { id: campus.id },
      update: {
        nameCn: normalizeCampusName(campus.name),
        latitude: campus.latitude,
        longitude: campus.longitude,
      },
      create: {
        id: campus.id,
        nameCn: normalizeCampusName(campus.name),
        latitude: campus.latitude,
        longitude: campus.longitude,
      },
    });
  }
}

async function upsertRoutes(prisma: PrismaClient, payload: BusStaticPayload) {
  for (const route of payload.routes) {
    await prisma.busRoute.upsert({
      where: { id: route.id },
      update: {
        nameCn: route.campuses.map((campus) => campus.name).join(" -> "),
        nameEn: buildRouteEnglishName(route.campuses),
      },
      create: {
        id: route.id,
        nameCn: route.campuses.map((campus) => campus.name).join(" -> "),
        nameEn: buildRouteEnglishName(route.campuses),
      },
    });

    await prisma.busRouteStop.deleteMany({
      where: { routeId: route.id },
    });

    await prisma.busRouteStop.createMany({
      data: route.campuses.map((campus, index) => ({
        routeId: route.id,
        campusId: campus.id,
        stopOrder: index,
      })),
    });
  }
}

async function createTripsForDayType(
  prisma: PrismaClient,
  versionId: number,
  dayType: "weekday" | "weekend",
  schedules: BusStaticRouteSchedule[],
) {
  let trips = 0;

  for (const schedule of schedules) {
    for (let position = 0; position < schedule.time.length; position += 1) {
      await prisma.busTrip.create({
        data: {
          versionId,
          routeId: schedule.route.id,
          dayType,
          position,
          stopTimes: schedule.time[position],
        },
      });
      trips += 1;
    }
  }

  return trips;
}

export async function importBusStaticPayload(
  prisma: PrismaClient,
  payload: BusStaticPayload,
  options?: {
    versionKey?: string | null;
    versionTitle?: string | null;
    effectiveFrom?: Date | null;
    effectiveUntil?: Date | null;
    disablePreviousVersions?: boolean;
  },
): Promise<BusImportResult> {
  assertRouteConsistency(payload);

  const checksum = checksumPayload(payload);
  const versionKey = inferVersionKey(payload, options?.versionKey);
  const versionTitle = inferVersionTitle(payload, options?.versionTitle);
  const effectiveFrom = inferEffectiveFrom(payload, options?.effectiveFrom);
  const effectiveUntil = options?.effectiveUntil ?? null;

  const existing = await prisma.busScheduleVersion.findFirst({
    where: {
      OR: [{ key: versionKey }, { checksum }],
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.busTrip.deleteMany({ where: { versionId: existing.id } });
    await prisma.busScheduleVersion.update({
      where: { id: existing.id },
      data: {
        key: versionKey,
        title: versionTitle,
        checksum,
        sourceMessage: payload.message?.message?.trim() || null,
        sourceUrl: payload.message?.url?.trim() || null,
        rawJson: payload,
        effectiveFrom,
        effectiveUntil,
        isEnabled: true,
      },
    });
  }

  if (options?.disablePreviousVersions !== false) {
    await prisma.busScheduleVersion.updateMany({
      where: existing
        ? { id: { not: existing.id } }
        : { key: { not: versionKey } },
      data: { isEnabled: false },
    });
  }

  await upsertCampuses(prisma, payload);
  await upsertRoutes(prisma, payload);

  const version =
    existing != null
      ? await prisma.busScheduleVersion.update({
          where: { id: existing.id },
          data: {
            importedAt: new Date(),
          },
          select: { id: true, key: true },
        })
      : await prisma.busScheduleVersion.create({
          data: {
            key: versionKey,
            title: versionTitle,
            checksum,
            sourceMessage: payload.message?.message?.trim() || null,
            sourceUrl: payload.message?.url?.trim() || null,
            rawJson: payload,
            effectiveFrom,
            effectiveUntil,
            isEnabled: true,
          },
          select: { id: true, key: true },
        });

  const [weekdayTrips, weekendTrips] = await Promise.all([
    createTripsForDayType(
      prisma,
      version.id,
      "weekday",
      payload.weekday_routes,
    ),
    createTripsForDayType(
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
