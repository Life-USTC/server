import { prisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { getBusPreference } from "./bus-preferences";
import {
  buildRouteSummary,
  getBusCampuses,
  getRouteRecords,
} from "./bus-route-builder";
import { buildTripSummary } from "./bus-trip-summary";
import type {
  BusDashboardSnapshot,
  BusRouteSummary,
  BusTimetableData,
  BusTimetableInput,
  BusTripSummary,
} from "./bus-types";
import {
  findEffectiveBusVersion,
  findEffectiveBusVersionFromRecords,
  listEnabledBusVersionRecords,
  summarizeBusVersions,
} from "./bus-version";

function busVersionNotice(version: {
  sourceMessage?: string | null;
  sourceUrl?: string | null;
}) {
  return version.sourceMessage || version.sourceUrl
    ? {
        message: version.sourceMessage ?? null,
        url: version.sourceUrl ?? null,
      }
    : null;
}

export async function getBusTimetableData(
  input: BusTimetableInput,
): Promise<BusTimetableData | null> {
  const locale = input.locale ?? "zh-cn";
  const now = input.now ? shanghaiDayjs(input.now) : shanghaiDayjs();
  const dateKey = now.format("YYYY-MM-DD");

  const versionRecords = await listEnabledBusVersionRecords();
  const version = input.versionKey
    ? await findEffectiveBusVersion(dateKey, input.versionKey)
    : findEffectiveBusVersionFromRecords(versionRecords, dateKey);
  if (!version) return null;

  const routeRecords = await getRouteRecords(locale);
  const campuses = await getBusCampuses(locale);
  const preference = await getBusPreference(input.userId ?? null);
  const tripRows = await prisma.busTrip.findMany({
    where: { versionId: version.id },
    orderBy: [{ dayType: "asc" }, { routeId: "asc" }, { position: "asc" }],
  });

  const versionRouteIds = new Set(tripRows.map((trip) => trip.routeId));
  const routes = routeRecords
    .filter((record) => versionRouteIds.has(record.id))
    .map((record) => buildRouteSummary(locale, record))
    .filter((record): record is BusRouteSummary => record != null);

  const routeMap = new Map(routes.map((route) => [route.id, route] as const));
  const trips = tripRows
    .map((trip) => {
      const route = routeMap.get(trip.routeId);
      if (!route) return null;
      return buildTripSummary(trip, route);
    })
    .filter((trip): trip is BusTripSummary => trip != null);

  return {
    locale,
    fetchedAt: now.toISOString(),
    version: {
      id: version.id,
      key: version.key,
      title: version.title,
      effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
      effectiveUntil: version.effectiveUntil?.toISOString() ?? null,
      importedAt: version.importedAt.toISOString(),
      notice: busVersionNotice(version),
    },
    campuses,
    routes,
    trips,
    availableVersions: summarizeBusVersions(versionRecords),
    preferences: preference,
    notice: busVersionNotice(version),
  };
}

export async function getBusDashboardSnapshot(
  input: Pick<BusTimetableInput, "locale" | "userId" | "now">,
): Promise<BusDashboardSnapshot | null> {
  const data = await getBusTimetableData({
    locale: input.locale,
    userId: input.userId,
    now: input.now,
  });

  if (!data) return null;
  return { data };
}
