import type { HomeworkFilter } from "@/features/dashboard/lib/dashboard-controller-helpers";

export function filterDashboardHomeworks<T extends { completion?: unknown }>(
  homeworks: T[],
  filter: HomeworkFilter,
) {
  return homeworks.filter((homework) => {
    if (filter === "all") return true;
    const completed = Boolean(homework.completion);
    return filter === "completed" ? completed : !completed;
  });
}
