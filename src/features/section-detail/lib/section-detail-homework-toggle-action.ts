import { updateSectionHomeworkCompletion } from "./homeworks";
import type { SectionHomework } from "./section-detail-controller-helpers";
import type { SectionDetailHomeworkActionInput } from "./section-detail-homework-action-types";
import { applySectionHomeworkCompletion } from "./section-detail-homework-state";

export function createSectionHomeworkToggleAction(
  input: SectionDetailHomeworkActionInput,
) {
  async function toggleHomeworkCompletion(homework: SectionHomework) {
    const result = await updateSectionHomeworkCompletion(
      homework.id,
      !homework.completion,
    );
    if (!result) return;
    const next = applySectionHomeworkCompletion({
      homeworkId: homework.id,
      homeworks: input.getHomeworks(),
      result,
      selectedHomework: input.getSelectedHomework(),
    });
    input.setHomeworks(next.homeworks);
    input.setSelectedHomework(next.selectedHomework);
  }

  return { toggleHomeworkCompletion };
}
