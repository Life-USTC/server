import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import type { CalendarView } from "@/features/dashboard/lib/calendar";
import type {
  CalendarEvents,
  CalendarExamEvent,
  CalendarHomeworkEvent,
  CalendarSessionEvent,
  CalendarTodoEvent,
} from "@/features/dashboard/lib/calendar-display";
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardRootCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SignedDashboardData,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import type { dashboardTabHref } from "@/features/dashboard/lib/dashboard-nav";

export type DashboardCalendarSession = CalendarSessionEvent & {
  dateKey?: string | null;
  sectionJwId: number | null;
};

export type DashboardCalendarExam = CalendarExamEvent & {
  dateKey?: string | null;
};

export type DashboardCalendarHomework = CalendarHomeworkEvent & {
  dateKey?: string | null;
};

export type DashboardCalendarTodo = CalendarTodoEvent & {
  dateKey?: string | null;
  priority: string;
};

export type DashboardCalendarData = {
  activeCalendarSemesterId: number | null;
  activeCalendarSemesterName?: string | null;
  allExams: DashboardCalendarExam[];
  allSessions: DashboardCalendarSession[];
  calendarSemesterNavList: Array<{ id: number; name?: string | null }>;
  semesterHomeworks: DashboardCalendarHomework[];
  semesterTodos: DashboardCalendarTodo[];
  semesterWeeks: string[][];
  todayDate: string;
};

export type DashboardCalendarEvents = CalendarEvents<
  DashboardCalendarSession,
  DashboardCalendarExam,
  DashboardCalendarHomework,
  DashboardCalendarTodo
>;

export type DashboardCalendarSignedData = SignedDashboardData & {
  bus?: DashboardBusData | null;
  calendarSubscriptionUrl?: string | null;
};

export type DashboardCalendarDateShift = (
  dateKey: string,
  amount: number,
) => string;

export type DashboardCalendarMonthWeeks = (month: string) => string[][];

export type DashboardCalendarEventsForDay = (
  calendar: DashboardCalendarData,
  dayKey: string,
) => DashboardCalendarEvents;

export type DashboardCalendarEventParts = (
  parts: Array<string | number | null | undefined>,
) => string;

export type DashboardCalendarTabHref = typeof dashboardTabHref;

export type DashboardCalendarControlsProps = {
  addDays: DashboardCalendarDateShift;
  addMonths: DashboardCalendarDateShift;
  calendarData: DashboardCalendarData | null;
  calendarMonth: string;
  calendarSemesterIndex: (calendar: DashboardCalendarData) => number;
  calendarView: CalendarView;
  calendarWeekStart: string;
  commonCopy: DashboardCommonCopy;
  dashboardCopy: DashboardDashboardCopy;
  sectionCopy: DashboardSectionCopy;
  setCalendarMonth: (month: string) => void;
  setCalendarSemester: (semesterId: number | null) => void;
  setCalendarView: (view: CalendarView) => void;
  setCalendarWeek: (weekStart: string) => void;
};

export type DashboardCalendarTabProps = DashboardCalendarControlsProps & {
  calendarEventParts: DashboardCalendarEventParts;
  calendarEventsForDay: DashboardCalendarEventsForDay;
  calendarExamDetail: (exam: DashboardCalendarExam) => string;
  calendarHomeworkDetail: (homework: DashboardCalendarHomework) => string;
  calendarHomeworkHref: (homework: DashboardCalendarHomework) => string;
  calendarSemesterId: number | null;
  calendarSessionDetail: (session: DashboardCalendarSession) => string;
  calendarTodoDetail: (todo: DashboardCalendarTodo) => string;
  calendarWeekLabel: (weekIndex: number) => string;
  calendarWeekdayLabels: string[];
  copy: DashboardRootCopy;
  copyCalendarLink: (event: MouseEvent) => void | Promise<void>;
  dashboardTabHref: DashboardCalendarTabHref;
  monthWeeks: DashboardCalendarMonthWeeks;
  sessionHref: (session: DashboardCalendarSession) => string;
  signedData: DashboardCalendarSignedData;
  subscriptionsCopy: DashboardSubscriptionsCopy;
};

export type DashboardPublicBusProps = {
  busCopy: DashboardBusCopy;
  signedData: DashboardCalendarSignedData;
};
