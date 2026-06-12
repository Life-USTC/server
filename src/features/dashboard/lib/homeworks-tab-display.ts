import type {
  DashboardDashboardCopy,
  DashboardHomeworkItem,
  DashboardSectionCopy,
} from "./dashboard-controller-types";
import { dashboardTabHref } from "./dashboard-nav";
import {
  formatDashboardDateTime,
  formatDashboardDueRelativeTime,
} from "./date-formatters";
import {
  homeworkCompletionActionLabel as buildHomeworkCompletionActionLabel,
  homeworkCourseLabel as buildHomeworkCourseLabel,
  homeworkDetailHref as buildHomeworkDetailHref,
  homeworkSectionHref as buildHomeworkSectionHref,
  homeworkSectionOptionLabel,
  homeworkStatusLabel,
} from "./homeworks";

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
  dashboardCopy,
  homeworkCopy,
  homeworksCopy,
  locale,
  referenceDate,
  sectionCopy,
}: {
  dashboardCopy: DashboardDashboardCopy;
  homeworkCopy: HomeworkCopy;
  homeworksCopy: HomeworksCopy;
  locale: string;
  referenceDate: Date | string;
  sectionCopy: DashboardSectionCopy;
}) {
  const returnTo = dashboardTabHref("homeworks");
  return {
    fmtDate: (value: Date | string | null | undefined) =>
      formatDashboardDateTime(
        value,
        sectionCopy.dateTBD,
        referenceDate,
        locale,
      ),
    homeworkCompletionActionLabel: (homework: DashboardHomeworkItem) =>
      buildHomeworkCompletionActionLabel(homework, {
        markComplete: homeworksCopy.markComplete,
        markIncomplete: homeworksCopy.markIncomplete,
      }),
    homeworkCourseLabel: (homework: DashboardHomeworkItem) =>
      buildHomeworkCourseLabel(homework, homeworkCopy.section),
    homeworkDetailHref: (homework: DashboardHomeworkItem) =>
      buildHomeworkDetailHref(homework, returnTo),
    homeworkEtaLabel: (value: Date | string | null | undefined) =>
      formatDashboardDueRelativeTime(
        value,
        sectionCopy.dateTBD,
        referenceDate,
        locale,
      ),
    homeworkSectionHref: (homework: DashboardHomeworkItem) =>
      buildHomeworkSectionHref(homework, returnTo),
    homeworkSectionLabel: (section: HomeworkSectionOption) =>
      homeworkSectionOptionLabel(section, dashboardCopy.notAvailable),
    homeworkStatus: (homework: DashboardHomeworkItem) =>
      homeworkStatusLabel(homework, {
        completed: dashboardCopy.completedStatus,
        pending: dashboardCopy.pendingStatus,
      }),
  };
}
