import type { getAssistantDashboardSnapshot } from "@/features/dashboard/server/assistant-dashboard-snapshot";

export type DashboardSnapshot = Awaited<
  ReturnType<typeof getAssistantDashboardSnapshot>
>;
export type DashboardSection =
  DashboardSnapshot["subscriptions"]["currentSemesterSections"][number];
export type DashboardTodo = DashboardSnapshot["todos"]["items"][number];
