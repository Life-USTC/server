import {
  compactBusRoute,
  compactBusTrip,
  compactBusTripSlot,
} from "./compact-bus";

type CompactArrayMatch = { matched: true; value: unknown } | { matched: false };

export function compactBusArrayItem(
  value: Record<string, unknown>,
): CompactArrayMatch {
  if (
    Object.hasOwn(value, "routeId") &&
    (value.dayType === "weekday" || value.dayType === "weekend") &&
    Object.hasOwn(value, "stopTimes") &&
    Array.isArray(value.stopTimes)
  ) {
    return { matched: true, value: compactBusTrip(value) };
  }

  if (
    Object.hasOwn(value, "position") &&
    Array.isArray(value.stopTimes) &&
    !Object.hasOwn(value, "routeId") &&
    !Object.hasOwn(value, "dayType")
  ) {
    return { matched: true, value: compactBusTripSlot(value) };
  }

  if (
    Object.hasOwn(value, "stops") &&
    Array.isArray(value.stops) &&
    Object.hasOwn(value, "routeId") &&
    typeof value.routeId === "string" &&
    !Object.hasOwn(value, "dayType")
  ) {
    return { matched: true, value: compactBusRoute(value) };
  }

  return { matched: false };
}
