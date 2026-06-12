import type {
  BusMapActiveTrip,
  BusMapRouteEdge,
} from "@/features/bus/lib/bus-types";
import { NODE_R, ROUTE_PALETTE, SVG_H } from "./bus-transit-map-constants";
import { canonicalPerpendicular, type Pos } from "./bus-transit-map-geometry";

type LabelOffset = {
  dx: number;
  dy: number;
  textAnchor: "start" | "middle" | "end";
};

export function routeColor(routeId: number, allRouteIds: number[]): string {
  const index = allRouteIds.indexOf(routeId);
  return ROUTE_PALETTE[index >= 0 ? index % ROUTE_PALETTE.length : 0];
}

export function labelOffset(position: Pos, label?: string): LabelOffset {
  if (label?.includes("东区")) {
    return { dx: NODE_R + 14, dy: 6, textAnchor: "start" };
  }
  if (label?.includes("南区")) {
    return { dx: -(NODE_R + 14), dy: 6, textAnchor: "end" };
  }
  if (label?.includes("先研院") || label?.includes("高新")) {
    return { dx: -(NODE_R + 14), dy: 6, textAnchor: "end" };
  }
  return {
    dx: 0,
    dy: position.y < SVG_H / 2 ? NODE_R + 18 : -(NODE_R + 8),
    textAnchor: "middle",
  };
}

export function hhmmToMin(value: string | null): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function lerp(first: Pos, second: Pos, progress: number): Pos {
  return {
    x: first.x + (second.x - first.x) * progress,
    y: first.y + (second.y - first.y) * progress,
  };
}

export function computeBusTransform(
  trip: BusMapActiveTrip,
  route: BusMapRouteEdge,
  positions: Map<number, Pos>,
  offsets: Map<string, Map<number, number>>,
): { x: number; y: number; angle: number } | null {
  if (trip.fromStopOrder == null || trip.toStopOrder == null) return null;
  const fromStop = route.stops[trip.fromStopOrder];
  const toStop = route.stops[trip.toStopOrder];
  if (!fromStop || !toStop) return null;
  const from = positions.get(fromStop.campusId);
  const to = positions.get(toStop.campusId);
  if (!from || !to) return null;

  const offset = canonicalPerpendicular(
    fromStop.campusId,
    toStop.campusId,
    trip.routeId,
    positions,
    offsets,
  );
  const progress = Math.max(0.15, Math.min(0.85, trip.segmentProgress ?? 0.5));
  const start = { x: from.x + offset.x, y: from.y + offset.y };
  const end = { x: to.x + offset.x, y: to.y + offset.y };
  const point = lerp(start, end, progress);
  return {
    x: point.x,
    y: point.y,
    angle: Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI),
  };
}
