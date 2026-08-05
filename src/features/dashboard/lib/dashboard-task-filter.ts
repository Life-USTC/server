export type DashboardTaskCompletionFilter = "incomplete" | "completed" | "all";

/**
 * Workspace task tabs default to "incomplete". When that bucket is empty,
 * fall back to "all" so users still see their history instead of an empty state.
 */
export function resolveDashboardTaskFilter(
  filter: DashboardTaskCompletionFilter,
  hasIncompleteItems: boolean,
): DashboardTaskCompletionFilter {
  if (filter === "incomplete" && !hasIncompleteItems) return "all";
  return filter;
}
