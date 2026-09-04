import {
  formatWorkspaceDateTime,
  formatWorkspaceDueRelativeTime,
  isWorkspaceDueOverdue,
} from "./date-formatters";
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
};

type HomeworkSectionOption = {
  course?: {
    code?: string | null;
    name?: string | null;
  } | null;
  courseCode?: string | null;
  courseName?: string | null;
  teacherName?: string | null;
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
  return {
    fmtDate: (value: Date | string | null | undefined) =>
      formatWorkspaceDateTime(
        value,
        sectionCopy.dateTBD,
        referenceDate,
        locale,
      ),
    homeworkCompletionActionLabel: (homework: WorkspaceHomeworkItem) =>
      buildHomeworkCompletionActionLabel(homework, {
        markComplete: homeworksCopy.markComplete,
        markIncomplete: homeworksCopy.markIncomplete,
      }),
    homeworkCourseLabel: (homework: WorkspaceHomeworkItem) =>
      buildHomeworkCourseLabel(homework, homeworkCopy.section),
    homeworkEtaLabel: (value: Date | string | null | undefined) =>
      formatWorkspaceDueRelativeTime(
        value,
        sectionCopy.dateTBD,
        referenceDate,
        locale,
      ),
    homeworkIsOverdue: (value: Date | string | null | undefined) =>
      isWorkspaceDueOverdue(value, referenceDate),
    homeworkSectionHref: (homework: WorkspaceHomeworkItem) =>
      buildHomeworkSectionHref(homework, returnTo),
    homeworkSectionLabel: (section: HomeworkSectionOption) =>
      homeworkSectionOptionLabel(section, workspaceCopy.notAvailable),
    homeworkStatus: (homework: WorkspaceHomeworkItem) =>
      homeworkStatusLabel(homework, {
        completed: workspaceCopy.completedStatus,
        pending: workspaceCopy.pendingStatus,
      }),
  };
}
