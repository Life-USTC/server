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
/** Campus node radius in SVG user units (halved from 28 for desktop visual weight). */
export const NODE_R = 14;
/**
 * Primary campus label size used for viewBox / width estimates and on narrow
 * viewports. Desktop CSS halves this via `max-md` so nodes no longer dominate
 * while #372 mobile `labelHeights >= 10` stays intact.
 */
export const CAMPUS_LABEL_FONT_PX = 28;
export const CAMPUS_LABEL_FONT_PX_DESKTOP = 14;
export const TRACK_SPACING = 9;
export const BUS_W = 20;
export const BUS_H = 12;
/** Extra margin around nodes so side/top labels stay inside the cropped viewBox. */
export const VIEW_BOX_EDGE = NODE_R + 80;
/** Widen portrait crops so full-width scaling does not produce a tower. */
export const MIN_VIEW_BOX_ASPECT = 1.2;
export const REFRESH_MS = 60_000;
