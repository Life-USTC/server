import { isHomeworkPendingForViewer } from "@/features/homeworks/lib/homework-completion-state";
import type { HomeworkFilter } from "@/features/workspace/lib/workspace-controller-helpers";

export function filterWorkspaceHomeworks<
  T extends {
    completion?: unknown;
    completionRequired?: boolean;
    submissionDueAt?: Date | string | null;
  },
>(homeworks: T[], filter: HomeworkFilter, referenceDate: Date = new Date()) {
  return homeworks.filter((homework) => {
    if (filter === "all") return true;
    const completed = Boolean(homework.completion);
    return filter === "completed"
      ? completed
      : isHomeworkPendingForViewer(
          {
            completion: homework.completion,
            completionRequired: homework.completionRequired,
            submissionDueAt: homework.submissionDueAt,
          },
          referenceDate,
        );
  });
}
