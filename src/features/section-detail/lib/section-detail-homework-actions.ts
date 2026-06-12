import type { SectionDetailHomeworkActionInput } from "./section-detail-homework-action-types";
import { createSectionHomeworkDeleteAction } from "./section-detail-homework-delete-action";
import { createSectionHomeworkLoadAction } from "./section-detail-homework-load-action";
import { createSectionHomeworkSubmitActions } from "./section-detail-homework-submit-actions";
import { createSectionHomeworkToggleAction } from "./section-detail-homework-toggle-action";

export function createSectionDetailHomeworkActions(
  input: SectionDetailHomeworkActionInput,
) {
  const { loadHomeworks } = createSectionHomeworkLoadAction(input);
  return {
    ...createSectionHomeworkSubmitActions(input, loadHomeworks),
    ...createSectionHomeworkDeleteAction(input, loadHomeworks),
    ...createSectionHomeworkToggleAction(input),
    loadHomeworks,
  };
}
