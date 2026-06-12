import type { HomeworkItem } from "./dashboard-controller-helpers";
import { updateHomeworkCompletion } from "./homeworks";

export async function toggleDashboardHomeworkCompletion(input: {
  errorMessage: string;
  homework: HomeworkItem;
}) {
  const result = await updateHomeworkCompletion({
    completed: !input.homework.completion,
    errorMessage: input.errorMessage,
    homeworkId: input.homework.id,
  });

  return {
    ...input.homework,
    completion: result.completed
      ? { completedAt: result.completedAt ?? new Date().toISOString() }
      : null,
  };
}
