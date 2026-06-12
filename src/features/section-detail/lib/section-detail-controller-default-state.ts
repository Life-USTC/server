import {
  type HomeworkAuditLog,
  type HomeworkViewer,
  normalizeSectionTab,
  type SectionDetailPageData,
  type SectionHomework,
  type SectionTab,
} from "@/features/section-detail/lib/section-detail-controller-helpers";
import type { SectionHomeworkView } from "@/features/section-detail/lib/section-detail-controller-navigation";

export function createSectionDetailControllerDefaultState(
  data: SectionDetailPageData,
) {
  return {
    _activeTab: (normalizeSectionTab(data.tab ?? null) ??
      "homework") as SectionTab,
    _calendarMonthOffset: 0,
    _clipboardError: "",
    _clipboardMessage: "",
    _copiedCalendarTarget: null as "single" | "subscription" | null,
    _createHomeworkPublishedAt: "",
    _createHomeworkSubmissionDueAt: "",
    _createHomeworkSubmissionStartAt: "",
    _deleteHomeworkTarget: null as SectionHomework | null,
    _editHomeworkMessage: "",
    _editHomeworkPublishedAt: "",
    _editHomeworkSubmissionDueAt: "",
    _editHomeworkSubmissionStartAt: "",
    _editingHomework: false,
    _homeworkAuditLogs: data.homeworkData.auditLogs as HomeworkAuditLog[],
    _homeworkMessage: "",
    _homeworkView: (data.homeworkView === "list"
      ? "list"
      : "cards") as SectionHomeworkView,
    _homeworkViewer: data.homeworkData.viewer as HomeworkViewer,
    _homeworks: data.homeworkData.homeworks as SectionHomework[],
    _isCalendarDialogOpen: false,
    _isHomeworkAuditDialogOpen: false,
    _origin: "",
    _selectedHomework: null as SectionHomework | null,
    _showCreateHomework: false,
    _showSubscribeDialog: data.showSubscribeDialog,
    _subscriptionPendingAction: null as "subscribe" | "unsubscribe" | null,
  };
}
