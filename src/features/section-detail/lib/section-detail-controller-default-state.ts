import type {
  HomeworkAuditLog,
  HomeworkViewer,
  SectionDetailPageData,
  SectionHomework,
} from "@/features/section-detail/lib/section-detail-controller-helpers";
import type { SectionHomeworkView } from "@/features/section-detail/lib/section-detail-controller-navigation";

export function createSectionDetailControllerDefaultState(
  data: SectionDetailPageData,
) {
  const focusedHomework =
    data.focusedHomeworkId == null
      ? null
      : (data.homeworkData.homeworks.find(
          (homework) => homework.id === data.focusedHomeworkId,
        ) ?? null);
  return {
    clipboardError: "",
    clipboardMessage: "",
    copiedCalendarTarget: null as "single" | "subscription" | null,
    completionSaving: false,
    createHomeworkPublishedAt: "",
    createHomeworkSubmissionDueAt: "",
    createHomeworkSubmissionStartAt: "",
    deleteHomeworkTarget: null as SectionHomework | null,
    editHomeworkMessage: "",
    editHomeworkPublishedAt: "",
    editHomeworkSubmissionDueAt: "",
    editHomeworkSubmissionStartAt: "",
    editingHomework: false,
    homeworkAuditLogs: data.homeworkData.auditLogs as HomeworkAuditLog[],
    homeworkMessage: "",
    homeworkView: (data.homeworkView === "list"
      ? "list"
      : "cards") as SectionHomeworkView,
    homeworkViewer: data.homeworkData.viewer as HomeworkViewer,
    homeworks: data.homeworkData.homeworks as SectionHomework[],
    isCalendarDialogOpen: false,
    isHomeworkAuditDialogOpen: false,
    origin: "",
    selectedHomework: focusedHomework as SectionHomework | null,
    showCreateHomework: false,
    showSubscribeDialog: data.showSubscribeDialog,
    subscriptionPendingAction: null as "subscribe" | "unsubscribe" | null,
  };
}
