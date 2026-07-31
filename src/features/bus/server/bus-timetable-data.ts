import {
  cachedCatalogRuntimeData,
  PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS,
} from "@/lib/catalog-runtime-cache";
import { prisma } from "@/lib/db/prisma";
import { getCanonicalOrigin } from "@/lib/site-url";
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
type CachedStaticBusTimetableData = Omit<StaticBusTimetableData, "fetchedAt">;

const STATIC_BUS_TIMETABLE_CACHE_TTL_MS = PUBLIC_CATALOG_RUNTIME_CACHE_TTL_MS;

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
  return JSON.stringify([
    input.locale,
    input.dateKey,
    input.versionKey == null
      ? { type: "auto" }
      : { key: input.versionKey, type: "explicit" },
  ]);
}

async function loadStaticBusTimetableData(input: {
  dateKey: string;
  locale: BusTimetableInput["locale"];
  versionKey?: string | null;
}): Promise<CachedStaticBusTimetableData | null> {
  const versionRecordsPromise = listEnabledBusVersionRecords();
  const explicitVersionPromise = input.versionKey
    ? findEffectiveBusVersion(input.dateKey, input.versionKey)
    : Promise.resolve(null);
  const [versionRecords, explicitVersion] = await Promise.all([
    versionRecordsPromise,
    explicitVersionPromise,
  ]);
  const version = input.versionKey
    ? explicitVersion
    : findEffectiveBusVersionFromRecords(versionRecords, input.dateKey);
  if (!version) return null;

  const [topology, tripRows] = await Promise.all([
    getBusVersionTopology(input.locale ?? "zh-cn", version.id),
    prisma.busTrip.findMany({
      where: { versionId: version.id },
      orderBy: [{ dayType: "asc" }, { routeId: "asc" }, { position: "asc" }],
    }),
  ]);
  if (!topology) return null;

  const locale = input.locale ?? "zh-cn";
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

  return {
    locale,
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

  const data = await cachedCatalogRuntimeData(
    `bus:timetable:${locale}`,
    cacheKey,
    getCanonicalOrigin(),
    () =>
      loadStaticBusTimetableData({
        dateKey,
        locale,
        versionKey: input.versionKey,
      }),
    {
      shouldCacheResult: (result) => result !== null,
      ttlMs: STATIC_BUS_TIMETABLE_CACHE_TTL_MS,
    },
  );

  return data ? { ...data, fetchedAt: now.toISOString() } : null;
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
