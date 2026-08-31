import {
  buildBusRouteNameData,
  normalizeBusCampusCoordinates,
  normalizeBusCampusName,
} from "../lib/bus-import-route-data";
import type {
  BusStaticPayload,
  BusStaticRouteSchedule,
} from "../lib/bus-types";
import type { BusImportWritePrisma } from "./bus-import-prisma";

export function assertBusRouteConsistency(payload: BusStaticPayload) {
  const routeIds = new Set(payload.routes.map((route) => route.id));
  for (const schedule of [
    ...payload.weekday_routes,
    ...payload.saturday_routes,
    ...payload.sunday_routes,
  ]) {
    if (!routeIds.has(schedule.route.id)) {
      throw new Error(
        `Unknown route id ${schedule.route.id} in schedule table`,
      );
    }
  }
}

export async function upsertBusCampuses(
  prisma: BusImportWritePrisma,
  payload: BusStaticPayload,
) {
  for (const campus of payload.campuses) {
    const { latitude, longitude } = normalizeBusCampusCoordinates(campus);
    const data = {
      nameCn: normalizeBusCampusName(campus.name),
      latitude,
      longitude,
    };
    const updated = await prisma.busCampus.updateMany({
      where: { id: campus.id },
      data,
    });
    if (updated.count === 0) {
      await prisma.busCampus.create({
        data: {
          id: campus.id,
          ...data,
        },
      });
    }
  }
}

export async function upsertBusRoutes(
  prisma: BusImportWritePrisma,
  payload: BusStaticPayload,
) {
  for (const route of payload.routes) {
    const routeNameData = buildBusRouteNameData(route.campuses);
    const updated = await prisma.busRoute.updateMany({
      where: { id: route.id },
      data: routeNameData,
    });
    if (updated.count === 0) {
      await prisma.busRoute.create({
        data: {
          id: route.id,
          ...routeNameData,
        },
      });
    }

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

export async function createBusTripsForDayType(
  prisma: BusImportWritePrisma,
  versionId: number,
  dayType: "weekday" | "saturday" | "sunday",
  schedules: BusStaticRouteSchedule[],
) {
  const trips = schedules.flatMap((schedule) =>
    schedule.time.map((stopTimes, position) => ({
      versionId,
      routeId: schedule.route.id,
      dayType,
      position,
      stopTimes,
    })),
  );

  if (trips.length > 0) {
    await prisma.busTrip.createMany({ data: trips });
  }

  return trips.length;
}
