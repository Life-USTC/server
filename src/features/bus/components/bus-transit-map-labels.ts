import { NODE_R, SVG_H, SVG_W } from "./bus-transit-map-constants";
import type { Pos } from "./bus-transit-map-types";

type LabelOffset = {
  dx: number;
  dy: number;
  textAnchor: "start" | "middle" | "end";
};

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
