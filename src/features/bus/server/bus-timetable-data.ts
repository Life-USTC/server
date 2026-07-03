import { prisma } from "@/lib/db/prisma";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { buildRouteSummary } from "../lib/bus-route-descriptions";
import { buildTripSummary } from "../lib/bus-trip-summary";
import type {
  BusDashboardSnapshot,
  BusRouteSummary,
  BusTimetableData,
  BusTimetableInput,
  BusTripSummary,
} from "../lib/bus-types";
import { getBusPreference } from "./bus-preferences";
import { getBusVersionTopology } from "./bus-route-records";
import {
  findEffectiveBusVersion,
  findEffectiveBusVersionFromRecords,
  listEnabledBusVersionRecords,
  summarizeBusVersions,
} from "./bus-version";

type StaticBusTimetableData = Omit<BusTimetableData, "preferences">;

const STATIC_BUS_TIMETABLE_CACHE_TTL_MS = 60_000;
const staticBusTimetableCache = new Map<
  string,
  { data: StaticBusTimetableData | null; expiresAt: number }
>();

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

function getStaticBusTimetableCacheKey(input: {
  dateKey: string;
  locale: string;
  versionKey?: string | null;
}) {
  return [input.locale, input.dateKey, input.versionKey ?? "auto"].join(":");
}

export async function getStaticBusTimetableData(
  input: BusTimetableInput,
): Promise<StaticBusTimetableData | null> {
  const locale = input.locale ?? "zh-cn";
  const now = input.now ? shanghaiDayjs(input.now) : shanghaiDayjs();
  const dateKey = now.format("YYYY-MM-DD");
  const cacheKey = getStaticBusTimetableCacheKey({
    dateKey,
    locale,
    versionKey: input.versionKey,
  });
  const cached = staticBusTimetableCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
      ? { ...cached.data, fetchedAt: now.toISOString() }
      : null;
  }

  const versionRecords = await listEnabledBusVersionRecords();
  const version = input.versionKey
    ? await findEffectiveBusVersion(dateKey, input.versionKey)
    : findEffectiveBusVersionFromRecords(versionRecords, dateKey);
  if (!version) {
    staticBusTimetableCache.set(cacheKey, {
      data: null,
      expiresAt: Date.now() + STATIC_BUS_TIMETABLE_CACHE_TTL_MS,
    });
    return null;
  }

  const [topology, tripRows] = await Promise.all([
    getBusVersionTopology(locale, version.id),
    prisma.busTrip.findMany({
      where: { versionId: version.id },
      orderBy: [{ dayType: "asc" }, { routeId: "asc" }, { position: "asc" }],
    }),
  ]);
  if (!topology) {
    staticBusTimetableCache.set(cacheKey, {
      data: null,
      expiresAt: Date.now() + STATIC_BUS_TIMETABLE_CACHE_TTL_MS,
    });
    return null;
  }

  const versionRouteIds = new Set(tripRows.map((trip) => trip.routeId));
  const routes = topology.routes
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

  const data = {
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
    campuses: topology.campuses,
    routes,
    trips,
    availableVersions: summarizeBusVersions(versionRecords),
    notice: busVersionNotice(version),
  };
  staticBusTimetableCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + STATIC_BUS_TIMETABLE_CACHE_TTL_MS,
  });
  return data;
}

export async function getBusTimetableData(
  input: BusTimetableInput,
): Promise<BusTimetableData | null> {
  const [data, preference] = await Promise.all([
    getStaticBusTimetableData(input),
    getBusPreference(input.userId ?? null),
  ]);
  if (!data) return null;

  return { ...data, preferences: preference };
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
