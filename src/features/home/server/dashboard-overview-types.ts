import type dayjs from "dayjs";
import type { TodoPriority } from "@/generated/prisma/client";
import type { AppLocale } from "@/i18n/config";
import type { createWeekDayFormatter } from "@/shared/lib/date-utils";
import type {
  buildTimeSlots,
  buildWeekDays,
  filterSessionsByDay,
  selectWeeklySessions,
} from "./dashboard-helpers";
import type { DashboardLinkSummary } from "./dashboard-link-data";
import type { DashboardUserSummary } from "./dashboard-nav-stats";
import type {
  ExamItem,
  HomeworkWithSection,
  SessionItem,
} from "./dashboard-types";

export type OverviewDataOptions = {
  locale?: AppLocale;
  /** Calendar tab: show semester/month/week grid for this semester (any known term). */
  calendarSemesterId?: number;
  /** Skip dashboard-links queries when the caller doesn't need them (e.g. calendar tab). */
  skipLinks?: boolean;
  /** Override the current time for deterministic snapshot and test views. */
  referenceNow?: Date;
  /** User row already loaded by the page shell. */
  user?: DashboardUserSummary;
  /** Subscription ids already loaded by the page shell. */
  sectionIds?: readonly number[];
};

export type CalendarTodoItem = {
  completed: boolean;
  id: string;
  title: string;
  dueAt: string;
  priority: TodoPriority;
  content: string | null;
};

export type OverviewData = {
  user: { id: string; name: string | null; username: string | null };
  currentTermName: string;
  hasAnySelection: boolean;
  hasCurrentTermSelection: boolean;
  todaySessions: ReturnType<typeof filterSessionsByDay>;
  tomorrowSessions: ReturnType<typeof filterSessionsByDay>;
  weeklySessions: ReturnType<typeof selectWeeklySessions>;
  weekDays: ReturnType<typeof buildWeekDays>;
  timeSlots: ReturnType<typeof buildTimeSlots>;
  incompleteHomeworks: HomeworkWithSection[];
  dueToday: HomeworkWithSection[];
  dueWithin3Days: HomeworkWithSection[];
  calendarSessions: ReturnType<typeof filterSessionsByDay>[];
  calendarHomeworks: HomeworkWithSection[];
  calendarDays: dayjs.Dayjs[];
  weekDayFormatter: ReturnType<typeof createWeekDayFormatter>;
  referenceNow: dayjs.Dayjs;
  todayStart: dayjs.Dayjs;
  semesterStart: dayjs.Dayjs | null;
  semesterEnd: dayjs.Dayjs | null;
  semesterWeeks: dayjs.Dayjs[][];
  allSessions: SessionItem[];
  allExams: ExamItem[];
  semesterHomeworks: HomeworkWithSection[];
  semesterTodos: CalendarTodoItem[];
  calendarSemesterPicker: { id: number; nameCn: string }[];
  calendarSemesterNavList: { id: number; nameCn: string }[];
  activeCalendarSemesterId: number | null;
  defaultCalendarSemesterId: number | null;
  activeCalendarSemesterName: string | null;
  dashboardLinks: DashboardLinkSummary[];
  recommendedLinks: DashboardLinkSummary[];
  pinnedLinks: DashboardLinkSummary[];
  overviewLinks: DashboardLinkSummary[];
};
