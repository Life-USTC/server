import type { HomeworkItem } from "./dashboard-controller-helpers";
import { toggleDashboardHomeworkCompletion } from "./dashboard-controller-homework-actions";

type HomeworkActionsCopy = {
  completionFailed: string;
};

export function createDashboardHomeworkStateActions(input: {
  getHomeworkItems: () => HomeworkItem[];
  getHomeworkSavingById: () => Record<string, boolean>;
  getHomeworksCopy: () => HomeworkActionsCopy;
  getSelectedHomework: () => HomeworkItem | null;
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
      const nextHomework = await toggleDashboardHomeworkCompletion({
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
