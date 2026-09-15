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
  BusRouteSummary,
  BusTimetableData,
  BusTimetableInput,
  BusTimetableSnapshot,
  BusTripSummary,
} from "../lib/bus-types";
import { getBusPreference } from "./bus-preferences";
import { getBusVersionTopology } from "./bus-route-records";
import {
  type BusVersionRuntime,
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
  version: BusVersionRuntime;
  versionKey?: string | null;
}) {
  return JSON.stringify([
    input.locale,
    input.dateKey,
    input.versionKey == null
      ? { type: "auto" }
      : { key: input.versionKey, type: "explicit" },
    {
      id: input.version.id,
      importedAt: input.version.importedAt.toISOString(),
    },
  ]);
}

async function loadStaticBusTimetableData(input: {
  locale: BusTimetableInput["locale"];
  version: BusVersionRuntime;
  versionRecords: BusVersionRuntime[];
}): Promise<CachedStaticBusTimetableData | null> {
  const [topology, tripRows] = await Promise.all([
    getBusVersionTopology(input.locale ?? "zh-cn", input.version.id),
    prisma.busTrip.findMany({
      where: { versionId: input.version.id },
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
      id: input.version.id,
      key: input.version.key,
      title: input.version.title,
      effectiveFrom: input.version.effectiveFrom?.toISOString() ?? null,
      effectiveUntil: input.version.effectiveUntil?.toISOString() ?? null,
      importedAt: input.version.importedAt.toISOString(),
      notice: busVersionNotice(input.version),
    },
    campuses: topology.campuses,
    routes,
    trips,
    availableVersions: summarizeBusVersions(input.versionRecords),
    notice: busVersionNotice(input.version),
  };
}

export async function getStaticBusTimetableData(
  input: BusTimetableInput,
): Promise<StaticBusTimetableData | null> {
  const locale = input.locale ?? "zh-cn";
  const now = input.now ? shanghaiDayjs(input.now) : shanghaiDayjs();
  const dateKey = now.format("YYYY-MM-DD");
  const versionRecordsPromise = listEnabledBusVersionRecords();
  const explicitVersionPromise = input.versionKey
    ? findEffectiveBusVersion(dateKey, input.versionKey)
    : Promise.resolve(null);
  const [versionRecords, explicitVersion] = await Promise.all([
    versionRecordsPromise,
    explicitVersionPromise,
  ]);
  const version = input.versionKey
    ? explicitVersion
    : findEffectiveBusVersionFromRecords(versionRecords, dateKey);
  if (!version) return null;

  const cacheKey = getStaticBusTimetableCacheKey({
    dateKey,
    locale,
    version,
    versionKey: input.versionKey,
  });

  const data = await cachedCatalogRuntimeData(
    `bus:timetable:${locale}`,
    cacheKey,
    getCanonicalOrigin(),
    () =>
      loadStaticBusTimetableData({
        locale,
        version,
        versionRecords,
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

export async function getBusTimetableSnapshot(
  input: Pick<BusTimetableInput, "locale" | "userId" | "now">,
): Promise<BusTimetableSnapshot | null> {
  const data = await getBusTimetableData({
    locale: input.locale,
    userId: input.userId,
    now: input.now,
  });

  if (!data) return null;
  return { data };
}
