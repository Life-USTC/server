import type { HomeworkFilter } from "@/features/workspace/lib/workspace-controller-helpers";

export function filterWorkspaceHomeworks<T extends { completion?: unknown }>(
  homeworks: T[],
  filter: HomeworkFilter,
) {
  return homeworks.filter((homework) => {
    if (filter === "all") return true;
    const completed = Boolean(homework.completion);
    return filter === "completed" ? completed : !completed;
  });
}
