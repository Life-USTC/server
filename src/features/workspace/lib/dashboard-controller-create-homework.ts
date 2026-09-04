import {
  homeworkDueAtSemesterEnd,
  homeworkDueInDays,
  homeworkDueInMonths,
  homeworkStartsNow,
  initialCreateHomeworkDraft,
} from "./dashboard-controller-helpers";

export function dashboardCreateHomeworkInitialState(sectionId: string) {
  const draft = initialCreateHomeworkDraft();
  return {
    advancedOpen: false,
    error: "",
    publishedAt: draft.publishedAt,
    sectionId,
    showDialog: true,
    submissionDueAt: draft.submissionDueAt,
    submissionStartAt: draft.submissionStartAt,
  };
}

export function dashboardHomeworkStartNow() {
  return homeworkStartsNow();
}

export function dashboardHomeworkDueInWeek() {
  return homeworkDueInDays(7);
}

export function dashboardHomeworkDueInMonth() {
  return homeworkDueInMonths(1);
}

export function dashboardHomeworkDueAtSemesterEnd(
  semesterEnd: string | Date | null | undefined,
) {
  return semesterEnd ? homeworkDueAtSemesterEnd(semesterEnd) : null;
}
