import { normalizeBusCampusCoordinates } from "@/features/bus/lib/bus-import-route-data";
import type { BusMapCampusNode } from "@/features/bus/lib/bus-types";
import {
  MIN_VIEW_BOX_ASPECT,
  NODE_R,
  PAD,
  SVG_H,
  SVG_W,
  VIEW_BOX_EDGE,
} from "./bus-transit-map-constants";
import {
  estimateCampusLabelWidth,
  labelOffset,
} from "./bus-transit-map-labels";
import type { MapViewBox, Pos } from "./bus-transit-map-types";

export type { MapViewBox, Pos } from "./bus-transit-map-types";

export function layoutCampuses(campuses: BusMapCampusNode[]): Map<number, Pos> {
  if (campuses.length === 0) return new Map();

  const normalized = campuses.map((campus) => ({
    id: campus.id,
    ...normalizeBusCampusCoordinates(campus),
  }));
  const longitudes = normalized.map((campus) => campus.longitude);
  const latitudes = normalized.map((campus) => campus.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const longitudeRange = maxLongitude - minLongitude || 1;
  const latitudeRange = maxLatitude - minLatitude || 1;
  const usableWidth = SVG_W - 2 * PAD;
  const usableHeight = SVG_H - 2 * PAD;
  const scale = Math.min(
    usableWidth / longitudeRange,
    usableHeight / latitudeRange,
  );
  const offsetX = PAD + (usableWidth - longitudeRange * scale) / 2;
  const offsetY = PAD + (usableHeight - latitudeRange * scale) / 2;

  const positions = normalized.map((campus) => ({
    id: campus.id,
    x: offsetX + (campus.longitude - minLongitude) * scale,
    y: offsetY + (maxLatitude - campus.latitude) * scale,
  }));

  const minGap = NODE_R * 4.5;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    let moved = false;
    for (let index = 0; index < positions.length; index += 1) {
      for (
        let nextIndex = index + 1;
        nextIndex < positions.length;
        nextIndex += 1
      ) {
        const first = positions[index];
        const second = positions[nextIndex];
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0 && distance < minGap) {
          const push = ((minGap - distance) / 2 + 1) / distance;
          first.x -= dx * push;
          first.y -= dy * push;
          second.x += dx * push;
          second.y += dy * push;
          moved = true;
        }
      }
    }
    for (const position of positions) {
      position.x = Math.max(PAD, Math.min(SVG_W - PAD, position.x));
      position.y = Math.max(PAD, Math.min(SVG_H - PAD, position.y));
    }
    if (!moved) break;
  }

  return new Map(positions.map((position) => [position.id, position]));
}

/** Crop the SVG to the graph so the network fills the rendered width. */
export function computeMapViewBox(
  positions: Map<number, Pos>,
  campuses: Pick<BusMapCampusNode, "id" | "namePrimary">[] = [],
): MapViewBox {
  if (positions.size === 0) {
    return { height: SVG_H, minX: 0, minY: 0, width: SVG_W };
  }

  const points = [...positions.values()];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  let minX = Math.min(...xs) - VIEW_BOX_EDGE;
  let maxX = Math.max(...xs) + VIEW_BOX_EDGE;
  let minY = Math.min(...ys) - VIEW_BOX_EDGE;
  let maxY = Math.max(...ys) + VIEW_BOX_EDGE;

  for (const campus of campuses) {
    const position = positions.get(campus.id);
    if (!position) continue;
    const label = labelOffset(position, campus.namePrimary);
    const width = estimateCampusLabelWidth(campus.namePrimary);
    const anchorX = position.x + label.dx;
    if (label.textAnchor === "end") {
      minX = Math.min(minX, anchorX - width);
    } else if (label.textAnchor === "start") {
      maxX = Math.max(maxX, anchorX + width);
    } else {
      minX = Math.min(minX, anchorX - width / 2);
      maxX = Math.max(maxX, anchorX + width / 2);
    }
    minY = Math.min(minY, position.y + label.dy - 32);
    maxY = Math.max(maxY, position.y + label.dy + 20);
  }

  let width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);

  // Portrait crops become enormous when stretched to full content width.
  if (width / height < MIN_VIEW_BOX_ASPECT) {
    const targetWidth = height * MIN_VIEW_BOX_ASPECT;
    const pad = (targetWidth - width) / 2;
    minX -= pad;
    maxX += pad;
    width = targetWidth;
  }

  return {
    height,
    minX,
    minY,
    width,
  };
}
