/**
 * Shared collection empty-state variants.
 *
 * - `filter-clear`: explain the active filter and offer clear-filter (outline).
 * - `browse`: no matches while browsing a catalog/collection.
 * - `setup`: first-run / no data yet; offer an authorized next action.
 * - `quiet`: one soft line; never spam per calendar cell.
 */

export const EMPTY_VARIANTS = [
  "filter-clear",
  "browse",
  "setup",
  "quiet",
] as const;

export type EmptyVariant = (typeof EMPTY_VARIANTS)[number];
