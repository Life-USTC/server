import type {
  BusMapActiveTrip,
  BusMapRouteEdge,
} from "@/features/bus/lib/bus-types";
import type { Pos } from "./bus-transit-map-campus-layout";
import {
  NODE_R,
  ROUTE_PALETTE,
  SVG_H,
  SVG_W,
} from "./bus-transit-map-constants";
import { canonicalPerpendicular } from "./bus-transit-map-routes";

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
  const sideGap = NODE_R + 20;
  // West campuses sit on the far left — label inward so text isn't cropped.
  if (label?.includes("高新") || label?.includes("先研院")) {
    return { dx: sideGap, dy: 8, textAnchor: "start" };
  }
  if (label?.includes("东区") || label?.includes("南区")) {
    return { dx: sideGap, dy: 8, textAnchor: "start" };
  }
  if (position.y > SVG_H * 0.75) {
    return position.x < SVG_W / 2
      ? { dx: -sideGap, dy: 8, textAnchor: "end" }
      : { dx: sideGap, dy: 8, textAnchor: "start" };
  }
  return {
    dx: 0,
    dy: position.y < SVG_H / 2 ? NODE_R + 28 : -(NODE_R + 14),
    textAnchor: "middle",
  };
}

/** Approximate rendered width for campus labels (28px CJK + stroke). */
export function estimateCampusLabelWidth(label: string): number {
  return Math.max(label.trim().length, 1) * 28 + 8;
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
