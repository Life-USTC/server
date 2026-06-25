import type {
  BusStaticCampus,
  BusStaticPayload,
  BusStaticRoute,
  BusStaticRouteSchedule,
} from "../../src/features/bus/lib/bus-types";
import { importBusStaticPayload } from "../../src/features/bus/server/bus-import";
import type { BusImportPrisma } from "../../src/features/bus/server/bus-import-prisma";
import type {
  SnapshotBusRouteStop,
  SnapshotBusTripStopTime,
  StaticSnapshot,
} from "./static-snapshot";

type StaticBusImportLogger = {
  info: (message: string) => void;
};

function buildBusPayload(snapshot: StaticSnapshot): BusStaticPayload {
  const campuses = snapshot.listBusCampuses();
  const campusMap = new Map<number, BusStaticCampus>(
    campuses.map((campus) => [
      campus.id,
      {
        id: campus.id,
        name: campus.name,
        latitude: campus.latitude,
        longitude: campus.longitude,
      },
    ]),
  );

  const routeStops = snapshot.listBusRouteStops();
  const routeMap = new Map<number, BusStaticRoute>();
  const stopsByRouteId = new Map<number, SnapshotBusRouteStop[]>();

  for (const stop of routeStops) {
    const stops = stopsByRouteId.get(stop.route_id);
    if (stops) {
      stops.push(stop);
    } else {
      stopsByRouteId.set(stop.route_id, [stop]);
    }
  }

  for (const route of snapshot.listBusRoutes()) {
    routeMap.set(route.id, {
      id: route.id,
      campuses: (stopsByRouteId.get(route.id) ?? [])
        .sort((left, right) => left.stop_order - right.stop_order)
        .map((stop) => {
          const campus = campusMap.get(stop.campus_id);
          if (!campus) {
            throw new Error(`Unknown bus campus id ${stop.campus_id}`);
          }
          return campus;
        }),
    });
  }

  const buildSchedules = (dayType: "weekday" | "weekend") => {
    const stopTimes = snapshot.listBusTripStopTimes(dayType);
    const groupedTrips = new Map<string, BusStaticRouteSchedule>();
    const stopTimesByTrip = new Map<string, SnapshotBusTripStopTime[]>();

    for (const stopTime of stopTimes) {
      const key = `${stopTime.schedule_id}:${stopTime.position}`;
      const times = stopTimesByTrip.get(key);
      if (times) {
        times.push(stopTime);
      } else {
        stopTimesByTrip.set(key, [stopTime]);
      }
    }

    for (const trip of snapshot.listBusTrips(dayType)) {
      const route = routeMap.get(trip.route_id);
      if (!route) {
        throw new Error(`Unknown bus route id ${trip.route_id}`);
      }

      const key = `${trip.schedule_id}`;
      let schedule = groupedTrips.get(key);
      if (!schedule) {
        schedule = {
          id: trip.schedule_id,
          route,
          time: [],
        };
        groupedTrips.set(key, schedule);
      }

      schedule.time[trip.position] = (
        stopTimesByTrip.get(`${trip.schedule_id}:${trip.position}`) ?? []
      )
        .sort((left, right) => left.stop_order - right.stop_order)
        .map((stopTime) => stopTime.departure_time);
    }

    return [...groupedTrips.values()].sort((left, right) => left.id - right.id);
  };

  const notice = snapshot.getBusNotice();

  return {
    campuses: [...campusMap.values()].sort((left, right) => left.id - right.id),
    routes: [...routeMap.values()].sort((left, right) => left.id - right.id),
    weekday_routes: buildSchedules("weekday"),
    weekend_routes: buildSchedules("weekend"),
    message: {
      message: notice?.message ?? "",
      url: notice?.url ?? "",
    },
  };
}

export async function importStaticBusData(
  db: BusImportPrisma,
  snapshot: StaticSnapshot,
  logger: StaticBusImportLogger,
) {
  logger.info("Loading bus data...");
  const payload = buildBusPayload(snapshot);

  const result = await importBusStaticPayload(db, payload, {
    versionKey: "static-bus-structured",
    versionTitle: "Static Structured Bus Timetable",
    effectiveFrom: null,
    effectiveUntil: null,
  });

  logger.info(
    `Imported bus data: version=${result.versionKey}, campuses=${result.campuses}, routes=${result.routes}, trips=${result.trips}`,
  );
}
