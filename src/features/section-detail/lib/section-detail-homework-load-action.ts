import { loadSectionHomeworks } from "./homeworks";
import type {
  HomeworkAuditLog,
  HomeworkViewer,
  SectionHomework,
} from "./section-detail-controller-helpers";
import type { SectionDetailHomeworkActionInput } from "./section-detail-homework-action-types";

export function createSectionHomeworkLoadAction(
  input: SectionDetailHomeworkActionInput,
) {
  async function loadHomeworks() {
    const homeworkCopy = input.getHomeworkCopy();
    try {
      const payload = await loadSectionHomeworks<
        HomeworkViewer,
        SectionHomework,
        HomeworkAuditLog
      >(input.getSectionId(), homeworkCopy.loadFailed);
      input.setHomeworkViewer(payload.viewer ?? input.getHomeworkViewer());
      const homeworks = payload.homeworks ?? input.getHomeworks();
      input.setHomeworks(homeworks);
      input.setHomeworkAuditLogs(payload.auditLogs ?? []);
      const selectedHomework = input.getSelectedHomework();
      if (selectedHomework) {
        input.setSelectedHomework(
          homeworks.find((homework) => homework.id === selectedHomework.id) ??
            selectedHomework,
        );
      }
    } catch (error) {
      input.setHomeworkMessage(
        error instanceof Error ? error.message : homeworkCopy.loadFailed,
      );
    }
  }

  return { loadHomeworks };
}
