import { updateHomeworkCompletion } from "@/features/homeworks/lib/homework-completion-client";
import type { SectionHomework } from "./section-detail-controller-helpers";
import type { SectionDetailHomeworkActionInput } from "./section-detail-homework-action-types";
import { applySectionHomeworkCompletion } from "./section-detail-homework-state";

export function createSectionHomeworkToggleAction(
  input: SectionDetailHomeworkActionInput,
) {
  async function toggleHomeworkCompletion(homework: SectionHomework) {
    const copy = input.getHomeworkCopy();
    input.setHomeworkMessage("");
    try {
      const result = await updateHomeworkCompletion({
        completed: !homework.completion,
        fallbackMessage: copy.completionFailed,
        homeworkId: homework.id,
      });
      const next = applySectionHomeworkCompletion({
        homeworkId: homework.id,
        homeworks: input.getHomeworks(),
        result,
        selectedHomework: input.getSelectedHomework(),
      });
      input.setHomeworks(next.homeworks);
      input.setSelectedHomework(next.selectedHomework);
    } catch {
      input.setHomeworkMessage(copy.completionFailed);
    }
  }

  return { toggleHomeworkCompletion };
}
