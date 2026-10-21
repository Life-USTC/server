/**
 * Desktop placement for the overview stack.
 *
 * The signed overview keeps one column on phones and splits into two from the
 * shared `lg` breakpoint. Focus, term context and shortcuts always own the full
 * content width; the urgency and upcoming lists share one row when both exist.
 * A single remaining list keeps the full width and flows its items into two
 * columns instead of leaving a dead half-row.
 */
export const OVERVIEW_FULL_WIDTH_CLASS = "lg:col-span-2";

export type OverviewListPlacement = {
  /** Extra classes for the list section. */
  class: string;
  /** The list renders its items in two desktop columns. */
  wide: boolean;
};

export function overviewListPlacement(counts: {
  urgency: number;
  upcoming: number;
}): { paired: boolean; list: OverviewListPlacement } {
  const paired = counts.urgency > 0 && counts.upcoming > 0;
  return {
    paired,
    list: {
      class: paired ? "" : OVERVIEW_FULL_WIDTH_CLASS,
      wide: !paired,
    },
  };
}
