import {
  DEMO_REFERENCE_NOW,
  type DemoIdentity,
} from "@/features/demo/lib/demo-types";
import type { SectionWithRelations } from "@/features/subscriptions/server/subscription-workspace-types";
import type { WorkspaceCalendarData } from "@/features/workspace/lib/workspace-controller-types";
import { getSemesterWeeks } from "@/features/workspace/server/workspace-calendar-helpers";
import {
  buildOverviewSemesterLists,
  resolveOverviewSemesterContext,
} from "@/features/workspace/server/workspace-overview-semesters";
import {
  buildExams,
  buildSessions,
  sortSessionsByStart,
} from "@/features/workspace/server/workspace-section-helpers";
import type { AppLocale } from "@/i18n/config";
import { shanghaiDayjs } from "@/lib/time/shanghai-dayjs";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import { getDemoCalendarEvents } from "./demo-calendar-events";
import { getDemoCatalogSection } from "./demo-catalog";
import { getDemoHomeworksTabData } from "./demo-homeworks";
import {
  getDemoSubscribedSections,
  getDemoSubscriptionsTabData,
} from "./demo-subscriptions";
import { getDemoTodos } from "./demo-todos";

/** Presentation adapter for the existing calendar, using the same fixed catalog facts as its API. */
export function getDemoCalendar(
  identity: DemoIdentity,
  locale: AppLocale,
  calendarSemesterId?: number,
): WorkspaceCalendarData {
  const semesters = getDemoSubscriptionsTabData(identity, locale).semesters.map(
    (semester) => ({
      ...semester,
      startDate: semester.startDate ? new Date(semester.startDate) : null,
      endDate: semester.endDate ? new Date(semester.endDate) : null,
    }),
  );
  const { gridSemesterRow, currentSemester } = resolveOverviewSemesterContext({
    calendarSemesterId,
    referenceDate: new Date(DEMO_REFERENCE_NOW),
    referenceNow: shanghaiDayjs(DEMO_REFERENCE_NOW),
    semesters,
  });
  const allSections: SectionWithRelations[] = getDemoSubscribedSections(
    locale,
  ).map((section) => {
    const detail = getDemoCatalogSection(section.jwId, locale);
    if (!detail) throw new Error("Missing demo calendar section");
    return {
      id: section.id,
      jwId: section.jwId,
      code: section.code,
      course: section.course,
      semester: section.semester,
      schedules: detail.schedules.map((schedule) => ({
        id: schedule.id,
        weekIndex: schedule.weekIndex,
        date: schedule.date ? new Date(schedule.date) : null,
        startTime: Number(schedule.startTime),
        endTime: Number(schedule.endTime),
        customPlace: schedule.customPlace,
        room: null,
        teachers: section.teachers,
      })),
      exams: detail.exams.map((exam) => ({
        ...exam,
        examDate: exam.examDate ? new Date(exam.examDate) : null,
      })),
    };
  });
  const selectedSections = allSections.filter(
    (section) => section.semester?.id === gridSemesterRow?.id,
  );
  const start = gridSemesterRow?.startDate;
  const end = gridSemesterRow?.endDate;
  const inSemester = (value: string | null | undefined) =>
    Boolean(
      value &&
        start &&
        end &&
        formatShanghaiDate(value) >= formatShanghaiDate(start) &&
        formatShanghaiDate(value) <= formatShanghaiDate(end),
    );
  const pendingHomeworkIds = new Set(
    getDemoCalendarEvents(locale)
      .filter(({ type }) => type === "homework_due")
      .map(({ target }) => target.id),
  );
  return {
    todayDate: DEMO_REFERENCE_NOW.slice(0, 10),
    referenceDate: DEMO_REFERENCE_NOW.slice(0, 10),
    allSessions: sortSessionsByStart(buildSessions(selectedSections)).map(
      (session) => ({ ...session, dateKey: formatShanghaiDate(session.date) }),
    ),
    allExams: buildExams(selectedSections).map((exam) => ({
      ...exam,
      dateKey: exam.date ? formatShanghaiDate(exam.date) : null,
    })),
    semesterHomeworks: getDemoHomeworksTabData(locale)
      .homeworkSummaries.filter(
        (homework) =>
          pendingHomeworkIds.has(homework.id) &&
          inSemester(homework.submissionDueAt),
      )
      .map((homework) => ({
        ...homework,
        dateKey: homework.submissionDueAt
          ? formatShanghaiDate(homework.submissionDueAt)
          : null,
      })),
    semesterTodos: getDemoTodos(locale)
      .filter((todo) => !todo.completed && inSemester(todo.dueAt))
      .map((todo) => ({
        ...todo,
        dateKey: todo.dueAt ? formatShanghaiDate(todo.dueAt) : null,
      })),
    ...buildOverviewSemesterLists({ allSections, semesters }),
    activeCalendarSemesterId: gridSemesterRow?.id ?? null,
    activeCalendarSemesterName: gridSemesterRow?.nameCn ?? null,
    defaultCalendarSemesterId: currentSemester?.id ?? null,
    semesterStart: start ? formatShanghaiDate(start) : null,
    semesterEnd: end ? formatShanghaiDate(end) : null,
    semesterWeeks:
      start && end
        ? getSemesterWeeks(shanghaiDayjs(start), shanghaiDayjs(end)).map(
            (week) => week.map((day) => day.format("YYYY-MM-DD")),
          )
        : [],
  };
}
