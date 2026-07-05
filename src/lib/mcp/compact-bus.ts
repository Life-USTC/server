import { isRecord } from "@/lib/is-record";
import { compactCampus } from "./compact-entities";
import {
  compactArrayRelations,
  compactRelations,
  pick,
} from "./compact-helpers";

function compactBusRouteStop(value: unknown) {
  if (!isRecord(value)) return value;
  if (Object.hasOwn(value, "campus")) {
    return { stopOrder: value.stopOrder, campus: compactCampus(value.campus) };
  }
  return pick(value, ["stopOrder", "campusId", "campusName"]);
}

export function compactBusRoute(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "nameCn",
      "nameEn",
      "descriptionPrimary",
      "descriptionSecondary",
      "routeId",
      "weekdayTrips",
      "weekendTrips",
      "stopCount",
    ]),
    ...compactArrayRelations(value, { stops: compactBusRouteStop }),
    ...compactRelations(value, {
      originCampus: (v) => compactCampus(v),
      destinationCampus: (v) => compactCampus(v),
    }),
  };
}

function compactBusStopTimes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      isRecord(item)
        ? pick(item, [
            "stopOrder",
            "campusId",
            "campusName",
            "time",
            "minutesSinceMidnight",
            "isPassThrough",
          ])
        : item,
    );
  }
  return value;
}

export function compactBusTrip(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...pick(value, [
      "id",
      "tripId",
      "routeId",
      "dayType",
      "position",
      "departureTime",
      "arrivalTime",
      "departureMinutes",
      "arrivalMinutes",
      "minutesUntilDeparture",
      "status",
      "departureEstimated",
      "arrivalEstimated",
    ]),
    ...compactRelations(value, {
      stopTimes: compactBusStopTimes,
      route: compactBusRoute,
      originCampus: (v) => compactCampus(v),
      destinationCampus: (v) => compactCampus(v),
    }),
  };
}

export function compactBusTripSlot(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    position: value.position,
    stopTimes: compactBusStopTimes(value.stopTimes),
  };
}
