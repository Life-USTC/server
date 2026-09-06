import {
  homeworkDueAtSemesterEnd,
  homeworkDueInDays,
  homeworkDueInMonths,
  homeworkStartsNow,
  initialCreateHomeworkDraft,
} from "./workspace-controller-helpers";

export function workspaceCreateHomeworkInitialState(sectionId: string) {
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

export function workspaceHomeworkStartNow() {
  return homeworkStartsNow();
}

export function workspaceHomeworkDueInWeek() {
  return homeworkDueInDays(7);
}

export function workspaceHomeworkDueInMonth() {
  return homeworkDueInMonths(1);
}

export function workspaceHomeworkDueAtSemesterEnd(
  semesterEnd: string | Date | null | undefined,
) {
  return semesterEnd ? homeworkDueAtSemesterEnd(semesterEnd) : null;
}
