import { loadSectionHomeworkDetail, loadSectionHomeworks } from "./homeworks";
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
        SectionHomework
      >(input.getSectionId(), homeworkCopy.loadFailed);
      input.setHomeworkViewer(payload.viewer ?? input.getHomeworkViewer());
      const homeworks = payload.homeworks ?? input.getHomeworks();
      input.setHomeworks(homeworks);
      input.setHomeworkAuditLogs([]);
      const selectedHomework = input.getSelectedHomework();
      if (selectedHomework) {
        const refreshedHomework = homeworks.find(
          (homework) => homework.id === selectedHomework.id,
        );
        if (!refreshedHomework) {
          input.setSelectedHomework(selectedHomework);
          return;
        }

        try {
          const detail = await loadSectionHomeworkDetail<
            SectionHomework,
            HomeworkAuditLog
          >(selectedHomework.id, homeworkCopy.loadFailed);
          if (input.getSelectedHomework()?.id !== selectedHomework.id) return;
          const { section: _section, ...scopedHomework } = detail.homework;
          input.setSelectedHomework(scopedHomework);
          input.setHomeworkAuditLogs(detail.auditLogs);
        } catch {
          if (input.getSelectedHomework()?.id !== selectedHomework.id) return;
          input.setSelectedHomework({
            ...selectedHomework,
            ...refreshedHomework,
          });
        }
      }
    } catch (error) {
      input.setHomeworkMessage(
        error instanceof Error ? error.message : homeworkCopy.loadFailed,
      );
    }
  }

  return { loadHomeworks };
}
