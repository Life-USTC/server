import { workspaceDeadlineLabels } from "./date-formatters";
import {
  homeworkCompletionActionLabel as buildHomeworkCompletionActionLabel,
  homeworkCourseLabel as buildHomeworkCourseLabel,
  homeworkSectionHref as buildHomeworkSectionHref,
  homeworkSectionOptionLabel,
  homeworkStatusLabel,
} from "./homeworks";
import type {
  WorkspaceCopy,
  WorkspaceHomeworkItem,
  WorkspaceSectionCopy,
} from "./workspace-controller-types";
import { workspaceTabHref } from "./workspace-nav";

type HomeworkCopy = Record<string, unknown> & {
  section: string;
};

type HomeworksCopy = Record<string, unknown> & {
  markComplete: string;
  markIncomplete: string;
  noCompletionRequired: string;
};

type HomeworkSectionOption = {
  course?: {
    code?: string | null;
    name?: string | null;
  } | null;
  courseCode?: string | null;
  courseName?: string | null;
  teacherName?: string | null;
  semesterName?: string | null;
};

export function createHomeworkTabDisplayActions({
  workspaceCopy,
  homeworkCopy,
  homeworksCopy,
  locale,
  referenceDate,
  sectionCopy,
}: {
  workspaceCopy: WorkspaceCopy;
  homeworkCopy: HomeworkCopy;
  homeworksCopy: HomeworksCopy;
  locale: string;
  referenceDate: Date | string;
  sectionCopy: WorkspaceSectionCopy;
}) {
  const returnTo = workspaceTabHref("homeworks");
  const { fmtDate, relativeDueLabel, isDueOverdue } = workspaceDeadlineLabels(
    referenceDate,
    locale,
    sectionCopy.dateTBD,
  );
  return {
    fmtDate,
    homeworkEtaLabel: relativeDueLabel,
    homeworkIsOverdue: isDueOverdue,
    homeworkCompletionActionLabel: (homework: WorkspaceHomeworkItem) =>
      buildHomeworkCompletionActionLabel(homework, {
        markComplete: homeworksCopy.markComplete,
        markIncomplete: homeworksCopy.markIncomplete,
      }),
    homeworkCourseLabel: (homework: WorkspaceHomeworkItem) =>
      buildHomeworkCourseLabel(homework, homeworkCopy.section),
    homeworkSectionHref: (homework: WorkspaceHomeworkItem) =>
      buildHomeworkSectionHref(homework, returnTo),
    homeworkSectionLabel: (section: HomeworkSectionOption) =>
      homeworkSectionOptionLabel(section, workspaceCopy.notAvailable),
    homeworkStatus: (homework: WorkspaceHomeworkItem) =>
      homeworkStatusLabel(homework, {
        completed: workspaceCopy.completedStatus,
        noCompletionRequired: homeworksCopy.noCompletionRequired,
        pending: workspaceCopy.pendingStatus,
      }),
  };
}
