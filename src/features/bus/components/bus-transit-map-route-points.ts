import type { BusMapRouteEdge } from "@/features/bus/lib/bus-types";
import type { Pos } from "./bus-transit-map-campus-layout";
import { canonicalPerpendicular } from "./bus-transit-map-segments";

export function buildRoutePoints(
  route: BusMapRouteEdge,
  positions: Map<number, Pos>,
  offsets: Map<string, Map<number, number>>,
): Pos[] {
  const points: Pos[] = [];
  for (let index = 0; index < route.stops.length; index += 1) {
    const base = positions.get(route.stops[index].campusId);
    if (!base) continue;

    const offset = routePointOffset(route, index, positions, offsets);
    points.push({ x: base.x + offset.x, y: base.y + offset.y });
  }
  return points;
}

function routePointOffset(
  route: BusMapRouteEdge,
  index: number,
  positions: Map<number, Pos>,
  offsets: Map<string, Map<number, number>>,
) {
  if (route.stops.length < 2) return { x: 0, y: 0 };

  if (index === 0) {
    return canonicalPerpendicular(
      route.stops[0].campusId,
      route.stops[1].campusId,
      route.routeId,
      positions,
      offsets,
    );
  }

  if (index === route.stops.length - 1) {
    return canonicalPerpendicular(
      route.stops[index - 1].campusId,
      route.stops[index].campusId,
      route.routeId,
      positions,
      offsets,
    );
  }

  return averageAdjacentOffsets(route, index, positions, offsets);
}

function averageAdjacentOffsets(
  route: BusMapRouteEdge,
  index: number,
  positions: Map<number, Pos>,
  offsets: Map<string, Map<number, number>>,
): Pos {
  const first = canonicalPerpendicular(
    route.stops[index - 1].campusId,
    route.stops[index].campusId,
    route.routeId,
    positions,
    offsets,
  );
  const second = canonicalPerpendicular(
    route.stops[index].campusId,
    route.stops[index + 1].campusId,
    route.routeId,
    positions,
    offsets,
  );
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export function pointsToPath(points: Pos[]): string {
  if (points.length < 2) return "";
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)},${point.y.toFixed(1)}`,
    )
    .join(" ");
}
