export const ROUTE_PALETTE = [
  "#0969da",
  "#cf222e",
  "#1a7f37",
  "#bc4c00",
  "#8250df",
  "#0891b2",
  "#bf3989",
  "#4f46e5",
  "#6f9c00",
  "#d1242f",
];

export const SVG_W = 900;
export const SVG_H = 560;
export const PAD = 56;
export const NODE_R = 28;
export const TRACK_SPACING = 9;
export const BUS_W = 20;
export const BUS_H = 12;
/** Extra margin around nodes so side/top labels stay inside the cropped viewBox. */
export const VIEW_BOX_EDGE = NODE_R + 80;
/** Widen portrait crops so full-width scaling does not produce a tower. */
export const MIN_VIEW_BOX_ASPECT = 1.2;
export const REFRESH_MS = 60_000;
