import type { BusImportPrisma } from "./bus-import-prisma";
import {
  buildBusRouteNameData,
  normalizeBusCampusName,
} from "./bus-import-route-data";
import type { BusStaticPayload, BusStaticRouteSchedule } from "./bus-types";

export function assertBusRouteConsistency(payload: BusStaticPayload) {
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

export async function upsertBusCampuses(
  prisma: BusImportPrisma,
  payload: BusStaticPayload,
) {
  for (const campus of payload.campuses) {
    await prisma.busCampus.upsert({
      where: { id: campus.id },
      update: {
        nameCn: normalizeBusCampusName(campus.name),
        latitude: campus.latitude,
        longitude: campus.longitude,
      },
      create: {
        id: campus.id,
        nameCn: normalizeBusCampusName(campus.name),
        latitude: campus.latitude,
        longitude: campus.longitude,
      },
    });
  }
}

export async function upsertBusRoutes(
  prisma: BusImportPrisma,
  payload: BusStaticPayload,
) {
  for (const route of payload.routes) {
    const routeNameData = buildBusRouteNameData(route.campuses);
    await prisma.busRoute.upsert({
      where: { id: route.id },
      update: routeNameData,
      create: {
        id: route.id,
        ...routeNameData,
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

export async function createBusTripsForDayType(
  prisma: BusImportPrisma,
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
