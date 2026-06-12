import type { BusMapRouteEdge } from "@/features/bus/lib/bus-types";
import type { Pos } from "./bus-transit-map-campus-layout";
import { TRACK_SPACING } from "./bus-transit-map-constants";

export function segmentKey(first: number, second: number) {
  return first < second ? `${first}-${second}` : `${second}-${first}`;
}

export function computeOffsets(routes: BusMapRouteEdge[]) {
  const segments = new Map<string, number[]>();
  for (const route of routes) {
    for (let index = 0; index < route.stops.length - 1; index += 1) {
      const key = segmentKey(
        route.stops[index].campusId,
        route.stops[index + 1].campusId,
      );
      const routeIds = segments.get(key) ?? [];
      if (!routeIds.includes(route.routeId)) routeIds.push(route.routeId);
      segments.set(key, routeIds);
    }
  }

  const result = new Map<string, Map<number, number>>();
  for (const [key, routeIds] of segments) {
    const offsets = new Map<number, number>();
    for (let index = 0; index < routeIds.length; index += 1) {
      offsets.set(
        routeIds[index],
        (index - (routeIds.length - 1) / 2) * TRACK_SPACING,
      );
    }
    result.set(key, offsets);
  }
  return result;
}

export function canonicalPerpendicular(
  firstCampusId: number,
  secondCampusId: number,
  routeId: number,
  positions: Map<number, Pos>,
  offsets: Map<string, Map<number, number>>,
): Pos {
  const key = segmentKey(firstCampusId, secondCampusId);
  const offset = offsets.get(key)?.get(routeId) ?? 0;
  if (offset === 0) return { x: 0, y: 0 };

  const [low, high] =
    firstCampusId < secondCampusId
      ? [firstCampusId, secondCampusId]
      : [secondCampusId, firstCampusId];
  const lowPosition = positions.get(low);
  const highPosition = positions.get(high);
  if (!lowPosition || !highPosition) return { x: 0, y: 0 };

  const dx = highPosition.x - lowPosition.x;
  const dy = highPosition.y - lowPosition.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: (-dy / length) * offset, y: (dx / length) * offset };
}
