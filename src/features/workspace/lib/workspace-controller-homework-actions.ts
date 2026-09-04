import {
  applyHomeworkCompletionResult,
  updateHomeworkCompletion,
} from "@/features/homeworks/lib/homework-completion-client";
import type { HomeworkItem } from "./workspace-controller-helpers";

export async function toggleWorkspaceHomeworkCompletion(input: {
  errorMessage: string;
  homework: HomeworkItem;
}) {
  const result = await updateHomeworkCompletion({
    completed: !input.homework.completion,
    fallbackMessage: input.errorMessage,
    homeworkId: input.homework.id,
  });

  return applyHomeworkCompletionResult(input.homework, result);
}
