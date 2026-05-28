import type {
  BusMapActiveTrip,
  BusMapCampusNode,
  BusMapRouteEdge,
} from "@/features/bus/lib/bus-types";

export const ROUTE_PALETTE = [
  "#dc2626",
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#0891b2",
  "#c026d3",
  "#4f46e5",
  "#65a30d",
  "#d97706",
];

export const SVG_W = 900;
export const SVG_H = 560;
export const PAD = 100;
export const NODE_R = 22;
export const TRACK_SPACING = 7;
export const BUS_W = 16;
export const BUS_H = 10;
export const REFRESH_MS = 60_000;

export type Pos = { x: number; y: number };

export function layoutCampuses(campuses: BusMapCampusNode[]): Map<number, Pos> {
  if (campuses.length === 0) return new Map();

  const realLons = campuses.map((c) => c.latitude);
  const realLats = campuses.map((c) => c.longitude);
  const minLon = Math.min(...realLons);
  const maxLon = Math.max(...realLons);
  const minLat = Math.min(...realLats);
  const maxLat = Math.max(...realLats);
  const rangeLon = maxLon - minLon || 1;
  const rangeLat = maxLat - minLat || 1;

  const usableW = SVG_W - 2 * PAD;
  const usableH = SVG_H - 2 * PAD;
  const scaleX = usableW / rangeLon;
  const scaleY = usableH / rangeLat;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = PAD + (usableW - rangeLon * scale) / 2;
  const offsetY = PAD + (usableH - rangeLat * scale) / 2;

  const positions: { id: number; x: number; y: number }[] = campuses.map(
    (c) => ({
      id: c.id,
      x: offsetX + (c.latitude - minLon) * scale,
      y: offsetY + (maxLat - c.longitude) * scale,
    }),
  );

  const minGap = NODE_R * 4.5;
  for (let iter = 0; iter < 60; iter += 1) {
    let moved = false;
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const a = positions[i];
        const b = positions[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < minGap && dist > 0) {
          const push = ((minGap - dist) / 2 + 1) / dist;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
          moved = true;
        }
      }
    }
    for (const p of positions) {
      p.x = Math.max(PAD, Math.min(SVG_W - PAD, p.x));
      p.y = Math.max(PAD, Math.min(SVG_H - PAD, p.y));
    }
    if (!moved) break;
  }

  const map = new Map<number, Pos>();
  for (const p of positions) map.set(p.id, { x: p.x, y: p.y });
  return map;
}

function segKey(a: number, b: number) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export function computeOffsets(routes: BusMapRouteEdge[]) {
  const seg = new Map<string, number[]>();
  for (const r of routes) {
    for (let i = 0; i < r.stops.length - 1; i += 1) {
      const k = segKey(r.stops[i].campusId, r.stops[i + 1].campusId);
      const list = seg.get(k) ?? [];
      if (!list.includes(r.routeId)) list.push(r.routeId);
      seg.set(k, list);
    }
  }

  const result = new Map<string, Map<number, number>>();
  for (const [k, ids] of seg) {
    const m = new Map<number, number>();
    for (let i = 0; i < ids.length; i += 1) {
      m.set(ids[i], (i - (ids.length - 1) / 2) * TRACK_SPACING);
    }
    result.set(k, m);
  }
  return result;
}

function canonicalPerp(
  campusA: number,
  campusB: number,
  routeId: number,
  positions: Map<number, Pos>,
  offsets: Map<string, Map<number, number>>,
): Pos {
  const k = segKey(campusA, campusB);
  const off = offsets.get(k)?.get(routeId) ?? 0;
  if (off === 0) return { x: 0, y: 0 };

  const [lo, hi] = campusA < campusB ? [campusA, campusB] : [campusB, campusA];
  const pLo = positions.get(lo);
  const pHi = positions.get(hi);
  if (!pLo || !pHi) return { x: 0, y: 0 };

  const dx = pHi.x - pLo.x;
  const dy = pHi.y - pLo.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (-dy / len) * off, y: (dx / len) * off };
}

export function buildRoutePoints(
  route: BusMapRouteEdge,
  positions: Map<number, Pos>,
  offsets: Map<string, Map<number, number>>,
): Pos[] {
  const pts: Pos[] = [];
  const stops = route.stops;

  for (let i = 0; i < stops.length; i += 1) {
    const base = positions.get(stops[i].campusId);
    if (!base) continue;

    let off: Pos;
    if (stops.length < 2) {
      off = { x: 0, y: 0 };
    } else if (i === 0) {
      off = canonicalPerp(
        stops[0].campusId,
        stops[1].campusId,
        route.routeId,
        positions,
        offsets,
      );
    } else if (i === stops.length - 1) {
      off = canonicalPerp(
        stops[i - 1].campusId,
        stops[i].campusId,
        route.routeId,
        positions,
        offsets,
      );
    } else {
      const a = canonicalPerp(
        stops[i - 1].campusId,
        stops[i].campusId,
        route.routeId,
        positions,
        offsets,
      );
      const b = canonicalPerp(
        stops[i].campusId,
        stops[i + 1].campusId,
        route.routeId,
        positions,
        offsets,
      );
      off = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }

    pts.push({ x: base.x + off.x, y: base.y + off.y });
  }
  return pts;
}

export function pointsToPath(pts: Pos[]): string {
  if (pts.length < 2) return "";
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

function lerp(a: Pos, b: Pos, t: number): Pos {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function routeColor(routeId: number, allIds: number[]): string {
  const idx = allIds.indexOf(routeId);
  return ROUTE_PALETTE[idx >= 0 ? idx % ROUTE_PALETTE.length : 0];
}

type LabelOffset = {
  dx: number;
  dy: number;
  textAnchor: "start" | "middle" | "end";
};

export function labelOffset(pos: Pos, label?: string): LabelOffset {
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
    dy: pos.y < SVG_H / 2 ? NODE_R + 18 : -(NODE_R + 8),
    textAnchor: "middle",
  };
}

export function hhmmToMin(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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

  const off = canonicalPerp(
    fromStop.campusId,
    toStop.campusId,
    trip.routeId,
    positions,
    offsets,
  );
  const p1 = { x: from.x + off.x, y: from.y + off.y };
  const p2 = { x: to.x + off.x, y: to.y + off.y };
  const t = Math.max(0.15, Math.min(0.85, trip.segmentProgress ?? 0.5));
  const pos = lerp(p1, p2, t);
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

  return { x: pos.x, y: pos.y, angle };
}
