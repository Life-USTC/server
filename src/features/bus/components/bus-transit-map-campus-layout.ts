import type { BusMapCampusNode } from "@/features/bus/lib/bus-types";
import { NODE_R, PAD, SVG_H, SVG_W } from "./bus-transit-map-constants";

export type Pos = { x: number; y: number };

export function layoutCampuses(campuses: BusMapCampusNode[]): Map<number, Pos> {
  if (campuses.length === 0) return new Map();

  const longitudes = campuses.map((campus) => campus.longitude);
  const latitudes = campuses.map((campus) => campus.latitude);
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

  const positions = campuses.map((campus) => ({
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
