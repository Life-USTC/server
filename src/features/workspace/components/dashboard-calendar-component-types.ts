import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/workspace/lib/bus-tab-types";
import type { CalendarView } from "@/features/workspace/lib/calendar";
import type { CalendarEvents } from "@/features/workspace/lib/calendar-display";
import type { DashboardTimelineItem } from "@/features/workspace/lib/dashboard-agenda";
import type {
  DashboardCommonCopy,
  CalendarData as DashboardControllerCalendarData,
  DashboardDashboardCopy,
  DashboardRootCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  SignedDashboardData,
} from "@/features/workspace/lib/dashboard-controller-helpers";
import type { dashboardTabHref } from "@/features/workspace/lib/dashboard-nav";

export type DashboardCalendarData = DashboardControllerCalendarData;
export type DashboardCalendarSession =
  DashboardCalendarData["allSessions"][number];
export type DashboardCalendarExam = DashboardCalendarData["allExams"][number];
export type DashboardCalendarHomework =
  DashboardCalendarData["semesterHomeworks"][number];
export type DashboardCalendarTodo =
  DashboardCalendarData["semesterTodos"][number];

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

export type DashboardCalendarTimelineItemsForDay = (
  events: DashboardCalendarEvents,
) => DashboardTimelineItem[];

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
  calendarTimelineItemsForDay: DashboardCalendarTimelineItemsForDay;
  calendarExamChipFields: (exam: DashboardCalendarExam) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarHomeworkChipFields: (homework: DashboardCalendarHomework) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarHomeworkHref: (homework: DashboardCalendarHomework) => string;
  calendarSemesterId: number | null;
  calendarSessionChipFields: (session: DashboardCalendarSession) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarTodoChipFields: (todo: DashboardCalendarTodo) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarWeekLabel: (weekIndex: number) => string;
  calendarWeekdayLabels: string[];
  copy: DashboardRootCopy;
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
