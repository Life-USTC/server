export {
  dateTimeInputValue,
  homeworkDueAtSemesterEnd,
  homeworkDueInDays,
  homeworkDueInMonths,
  homeworkStartAtSemesterStart,
  homeworkTimestampNow,
  initialHomeworkTimestampDraft as initialHomeworkDraft,
} from "@/features/homeworks/lib/homework-timestamp-defaults";
export type {
  ExamItem,
  HomeworkAuditLog,
  HomeworkViewer,
  ScheduleItem,
  SectionDetailActionData,
  SectionDetailPageData,
  SectionHomework,
} from "./section-detail-controller-types";
export {
  sectionSemesterDate,
  sectionSemesterWeekLabel,
} from "./section-detail-semester-week";
export {
  homeworkViewStorageKey,
  normalizeSectionTab,
  type SectionTab,
  sectionTabFromHash,
  sectionTabIds,
} from "./section-detail-tabs";
