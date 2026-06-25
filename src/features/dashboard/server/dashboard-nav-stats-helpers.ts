import type { DashboardNavStats } from "./dashboard-nav-stats";
import type { DashboardUserSummary } from "./dashboard-user-context";

export function dashboardNavUserSummary(user: DashboardUserSummary) {
  return { id: user.id, name: user.name, username: user.username };
}

export function emptyDashboardNavStats(input: {
  pendingTodosCount: number;
  user: DashboardUserSummary;
}): DashboardNavStats {
  return {
    user: dashboardNavUserSummary(input.user),
    calendarItemsCount: 0,
    pendingHomeworksCount: 0,
    highlightPendingHomeworks: false,
    examsCount: 0,
    pendingTodosCount: input.pendingTodosCount,
  };
}
