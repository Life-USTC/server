import { deleteSectionHomework } from "./homeworks";
import type { SectionDetailHomeworkActionInput } from "./section-detail-homework-action-types";
import { removeSectionHomework } from "./section-detail-homework-state";

export function createSectionHomeworkDeleteAction(
  input: SectionDetailHomeworkActionInput,
  loadHomeworks: () => Promise<void>,
) {
  async function deleteHomework() {
    const deleteTarget = input.getDeleteHomeworkTarget();
    if (!deleteTarget) return;
    const deleted = await deleteSectionHomework(deleteTarget.id);
    if (!deleted) return;
    const next = removeSectionHomework({
      deletedId: deleteTarget.id,
      homeworks: input.getHomeworks(),
      selectedHomework: input.getSelectedHomework(),
    });
    input.setHomeworks(next.homeworks);
    input.setSelectedHomework(next.selectedHomework);
    input.setDeleteHomeworkTarget(null);
    await loadHomeworks();
  }

  return { deleteHomework };
}
