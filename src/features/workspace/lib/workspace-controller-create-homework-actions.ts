import {
  workspaceCreateHomeworkInitialState,
  workspaceHomeworkDueAtSemesterEnd,
  workspaceHomeworkDueInMonth,
  workspaceHomeworkDueInWeek,
  workspaceHomeworkStartNow,
} from "./workspace-controller-create-homework";
import type { SignedWorkspaceData } from "./workspace-controller-helpers";

type CreateHomeworkSection = NonNullable<
  SignedWorkspaceData["homeworks"]
>["sections"][number];

export function createWorkspaceCreateHomeworkActions(input: {
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
    const next = workspaceCreateHomeworkInitialState(
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
    input.setCreateHomeworkSubmissionStartAt(workspaceHomeworkStartNow());
  }

  function applyHomeworkDueInWeek() {
    input.setCreateHomeworkSubmissionDueAt(workspaceHomeworkDueInWeek());
  }

  function applyHomeworkDueInMonth() {
    input.setCreateHomeworkSubmissionDueAt(workspaceHomeworkDueInMonth());
  }

  function applyHomeworkDueAtSemesterEnd() {
    const dueAt = workspaceHomeworkDueAtSemesterEnd(
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
