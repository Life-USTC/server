import type {
  WorkspaceBusCopy,
  WorkspaceBusData,
} from "@/features/workspace/lib/bus-tab-types";
import type { CalendarView } from "@/features/workspace/lib/calendar";
import type { CalendarEvents } from "@/features/workspace/lib/calendar-display";
import type { WorkspaceTimelineItem } from "@/features/workspace/lib/workspace-agenda";
import type {
  SignedWorkspaceData,
  WorkspaceCommonCopy,
  CalendarData as WorkspaceControllerCalendarData,
  WorkspaceCopy,
  WorkspaceRootCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type { workspaceTabHref } from "@/features/workspace/lib/workspace-nav";

export type WorkspaceCalendarData = WorkspaceControllerCalendarData;
export type WorkspaceCalendarSession =
  WorkspaceCalendarData["allSessions"][number];
export type WorkspaceCalendarExam = WorkspaceCalendarData["allExams"][number];
export type WorkspaceCalendarHomework =
  WorkspaceCalendarData["semesterHomeworks"][number];
export type WorkspaceCalendarTodo =
  WorkspaceCalendarData["semesterTodos"][number];

export type WorkspaceCalendarEvents = CalendarEvents<
  WorkspaceCalendarSession,
  WorkspaceCalendarExam,
  WorkspaceCalendarHomework,
  WorkspaceCalendarTodo
>;

export type WorkspaceCalendarSignedData = SignedWorkspaceData & {
  bus?: WorkspaceBusData | null;
  calendarSubscriptionUrl?: string | null;
};

export type WorkspaceCalendarDateShift = (
  dateKey: string,
  amount: number,
) => string;

export type WorkspaceCalendarMonthWeeks = (month: string) => string[][];

export type WorkspaceCalendarEventsForDay = (
  calendar: WorkspaceCalendarData,
  dayKey: string,
) => WorkspaceCalendarEvents;

export type WorkspaceCalendarTimelineItemsForDay = (
  events: WorkspaceCalendarEvents,
) => WorkspaceTimelineItem[];

export type WorkspaceCalendarEventParts = (
  parts: Array<string | number | null | undefined>,
) => string;

export type WorkspaceCalendarTabHref = typeof workspaceTabHref;

export type WorkspaceCalendarControlsProps = {
  addDays: WorkspaceCalendarDateShift;
  addMonths: WorkspaceCalendarDateShift;
  calendarData: WorkspaceCalendarData | null;
  calendarMonth: string;
  calendarSemesterIndex: (calendar: WorkspaceCalendarData) => number;
  calendarView: CalendarView;
  calendarWeekStart: string;
  commonCopy: WorkspaceCommonCopy;
  workspaceCopy: WorkspaceCopy;
  sectionCopy: WorkspaceSectionCopy;
  setCalendarMonth: (month: string) => void;
  setCalendarSemester: (semesterId: number | null) => void;
  setCalendarView: (view: CalendarView) => void;
  setCalendarWeek: (weekStart: string) => void;
};

export type WorkspaceCalendarTabProps = WorkspaceCalendarControlsProps & {
  calendarEventParts: WorkspaceCalendarEventParts;
  calendarEventsForDay: WorkspaceCalendarEventsForDay;
  calendarTimelineItemsForDay: WorkspaceCalendarTimelineItemsForDay;
  calendarExamChipFields: (exam: WorkspaceCalendarExam) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarHomeworkChipFields: (homework: WorkspaceCalendarHomework) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarHomeworkHref: (homework: WorkspaceCalendarHomework) => string;
  calendarSemesterId: number | null;
  calendarSessionChipFields: (session: WorkspaceCalendarSession) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarTodoChipFields: (todo: WorkspaceCalendarTodo) => {
    detail: string;
    meta: string;
    tooltipDetail?: string;
  };
  calendarWeekLabel: (weekIndex: number) => string;
  calendarWeekdayLabels: string[];
  copy: WorkspaceRootCopy;
  workspaceTabHref: WorkspaceCalendarTabHref;
  monthWeeks: WorkspaceCalendarMonthWeeks;
  sessionHref: (session: WorkspaceCalendarSession) => string;
  signedData: WorkspaceCalendarSignedData;
  subscriptionsCopy: WorkspaceSubscriptionsCopy;
};

export type WorkspacePublicBusProps = {
  busCopy: WorkspaceBusCopy;
  signedData: WorkspaceCalendarSignedData;
};
