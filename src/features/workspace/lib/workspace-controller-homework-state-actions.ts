import type { HomeworkItem } from "./workspace-controller-helpers";
import { toggleWorkspaceHomeworkCompletion } from "./workspace-controller-homework-actions";

type HomeworkActionsCopy = {
  completionFailed: string;
  markComplete: string;
  markIncomplete: string;
};

export function createWorkspaceHomeworkStateActions(input: {
  getHomeworkItems: () => HomeworkItem[];
  getHomeworkSavingById: () => Record<string, boolean>;
  getHomeworksCopy: () => HomeworkActionsCopy;
  getSelectedHomework: () => HomeworkItem | null;
  onSuccess?: (action: "complete" | "uncomplete") => void;
  setHomeworkActionError: (value: string) => void;
  setHomeworkItems: (value: HomeworkItem[]) => void;
  setHomeworkSavingById: (value: Record<string, boolean>) => void;
  setSelectedHomework: (value: HomeworkItem | null) => void;
}) {
  function setHomeworkSaving(homeworkId: string, saving: boolean) {
    input.setHomeworkSavingById({
      ...input.getHomeworkSavingById(),
      [homeworkId]: saving,
    });
  }

  async function toggleHomeworkCompletion(homework: HomeworkItem) {
    if (input.getHomeworkSavingById()[homework.id]) return;
    input.setHomeworkActionError("");
    setHomeworkSaving(homework.id, true);
    try {
      const nextHomework = await toggleWorkspaceHomeworkCompletion({
        errorMessage: input.getHomeworksCopy().completionFailed,
        homework,
      });
      input.setHomeworkItems(
        input
          .getHomeworkItems()
          .map((item) => (item.id === nextHomework.id ? nextHomework : item)),
      );
      if (input.getSelectedHomework()?.id === homework.id) {
        input.setSelectedHomework(nextHomework);
      }
      input.onSuccess?.(nextHomework.completion ? "complete" : "uncomplete");
    } catch {
      input.setHomeworkActionError(input.getHomeworksCopy().completionFailed);
    } finally {
      setHomeworkSaving(homework.id, false);
    }
  }

  return {
    toggleHomeworkCompletion,
  };
}
