import {
  dashboardCreateHomeworkInitialState,
  dashboardHomeworkDueAtSemesterEnd,
  dashboardHomeworkDueInMonth,
  dashboardHomeworkDueInWeek,
  dashboardHomeworkStartNow,
} from "./dashboard-controller-create-homework";
import type { SignedDashboardData } from "./dashboard-controller-helpers";

type CreateHomeworkSection = NonNullable<
  SignedDashboardData["homeworks"]
>["sections"][number];

export function createDashboardCreateHomeworkActions(input: {
  getCreateHomeworkSectionId: () => string;
  getSections: () => CreateHomeworkSection[];
  setCreateHomeworkAdvancedOpen: (value: boolean) => void;
  setCreateHomeworkError: (value: string) => void;
  setCreateHomeworkPublishedAt: (value: string) => void;
  setCreateHomeworkSectionId: (value: string) => void;
  setCreateHomeworkSubmissionDueAt: (value: string) => void;
  setCreateHomeworkSubmissionStartAt: (value: string) => void;
  setShowCreateHomework: (value: boolean) => void;
}) {
  function selectedCreateHomeworkSection() {
    return (
      input
        .getSections()
        .find(
          (section) =>
            String(section.id) === input.getCreateHomeworkSectionId(),
        ) ?? null
    );
  }

  function openCreateHomeworkDialog() {
    const next = dashboardCreateHomeworkInitialState(
      String(input.getSections()[0]?.id ?? ""),
    );
    input.setCreateHomeworkSectionId(next.sectionId);
    input.setCreateHomeworkPublishedAt(next.publishedAt);
    input.setCreateHomeworkSubmissionStartAt(next.submissionStartAt);
    input.setCreateHomeworkSubmissionDueAt(next.submissionDueAt);
    input.setCreateHomeworkAdvancedOpen(next.advancedOpen);
    input.setCreateHomeworkError(next.error);
    input.setShowCreateHomework(next.showDialog);
  }

  function applyHomeworkStartNow() {
    input.setCreateHomeworkSubmissionStartAt(dashboardHomeworkStartNow());
  }

  function applyHomeworkDueInWeek() {
    input.setCreateHomeworkSubmissionDueAt(dashboardHomeworkDueInWeek());
  }

  function applyHomeworkDueInMonth() {
    input.setCreateHomeworkSubmissionDueAt(dashboardHomeworkDueInMonth());
  }

  function applyHomeworkDueAtSemesterEnd() {
    const dueAt = dashboardHomeworkDueAtSemesterEnd(
      selectedCreateHomeworkSection()?.semesterEnd as
        | string
        | Date
        | null
        | undefined,
    );
    if (dueAt) input.setCreateHomeworkSubmissionDueAt(dueAt);
  }

  return {
    applyHomeworkDueAtSemesterEnd,
    applyHomeworkDueInMonth,
    applyHomeworkDueInWeek,
    applyHomeworkStartNow,
    openCreateHomeworkDialog,
    selectedCreateHomeworkSection,
  };
}
