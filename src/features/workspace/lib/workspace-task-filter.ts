export type WorkspaceTaskCompletionFilter = "incomplete" | "completed" | "all";

/**
 * Workspace task tabs default to "incomplete". When that bucket is empty,
 * fall back to "all" so users still see their history instead of an empty state.
 */
export function resolveWorkspaceTaskFilter(
  filter: WorkspaceTaskCompletionFilter,
  hasIncompleteItems: boolean,
): WorkspaceTaskCompletionFilter {
  if (filter === "incomplete" && !hasIncompleteItems) return "all";
  return filter;
}
