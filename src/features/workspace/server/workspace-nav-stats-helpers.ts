import type { WorkspaceNavStats } from "./workspace-nav-stats";
import type { WorkspaceUserSummary } from "./workspace-user-context";

export function workspaceNavUserSummary(user: WorkspaceUserSummary) {
  return { id: user.id, name: user.name, username: user.username };
}

export function emptyWorkspaceNavStats(input: {
  pendingTodosCount: number;
  user: WorkspaceUserSummary;
}): WorkspaceNavStats {
  return {
    user: workspaceNavUserSummary(input.user),
    calendarItemsCount: 0,
    pendingHomeworksCount: 0,
    highlightPendingHomeworks: false,
    examsCount: 0,
    pendingTodosCount: input.pendingTodosCount,
  };
}
