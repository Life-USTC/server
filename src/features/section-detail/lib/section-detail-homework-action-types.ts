import type {
  HomeworkAuditLog,
  HomeworkViewer,
  SectionDetailPageData,
  SectionHomework,
} from "./section-detail-controller-helpers";

export type HomeworkCopy = SectionDetailPageData["copy"]["homeworks"];

export type SectionDetailHomeworkActionInput = {
  cancelEditHomework: () => void;
  closeCreateHomeworkDialog: () => void;
  getCreateHomeworkPublishedAt: () => string;
  getCreateHomeworkSubmissionDueAt: () => string;
  getCreateHomeworkSubmissionStartAt: () => string;
  getDeleteHomeworkTarget: () => SectionHomework | null;
  getEditHomeworkPublishedAt: () => string;
  getEditHomeworkSubmissionDueAt: () => string;
  getEditHomeworkSubmissionStartAt: () => string;
  getHomeworkCopy: () => HomeworkCopy;
  getHomeworkViewer: () => HomeworkViewer;
  getHomeworks: () => SectionHomework[];
  getSelectedHomework: () => SectionHomework | null;
  getSectionId: () => number;
  setDeleteHomeworkTarget: (value: SectionHomework | null) => void;
  setEditHomeworkMessage: (value: string) => void;
  setHomeworkAuditLogs: (value: HomeworkAuditLog[]) => void;
  setHomeworkMessage: (value: string) => void;
  setHomeworkViewer: (value: HomeworkViewer) => void;
  setHomeworks: (value: SectionHomework[]) => void;
  setSelectedHomework: (value: SectionHomework | null) => void;
};
