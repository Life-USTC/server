import type {
  DashboardBusCopy,
  DashboardBusData,
} from "@/features/dashboard/lib/bus-tab-types";
import type { CalendarView } from "@/features/dashboard/lib/calendar";
import type {
  DashboardExamRow,
  DashboardExamSection,
} from "@/features/dashboard/lib/exams";
import type { MatchedSubscriptionSection } from "@/features/dashboard/lib/subscriptions";
import type { DashboardLinkGroup } from "@/features/dashboard-links/lib/dashboard-links";

type DashboardRecord = Record<string, unknown>;

export type DashboardCommonCopy = DashboardRecord & {
  courses: string;
  next: string;
  previous: string;
  semesters: string;
  sections: string;
  userNotFound: string;
};

export type DashboardRootCopy = DashboardRecord & {
  CalendarEventCard: {
    exam: string;
    homework: string;
    todo: string;
  };
  bus: DashboardBusCopy;
  comments: DashboardRecord;
  common: DashboardCommonCopy;
  dashboard: DashboardDashboardCopy;
  homepage: DashboardRecord;
  homeworks: DashboardHomeworksCopy;
  myHomeworks: DashboardMyHomeworksCopy;
  sectionDetail: DashboardSectionCopy;
  subscriptions: DashboardSubscriptionsCopy;
  todos: DashboardTodosCopy;
  metadata: {
    home: string;
  };
};

export type DashboardDashboardCopy = DashboardRecord & {
  linkHub: {
    credit: string;
    creditSuffix: string;
    empty: string;
    gridView: string;
    groups: Record<string, string>;
    listView: string;
    pin: string;
    pinFailedDescription: string;
    pinFailedTitle: string;
    searchPlaceholder: string;
    unpin: string;
    viewMode: string;
  };
  moreItems: string;
  notAvailable: string;
  nav: {
    ariaLabel: string;
    calendar: { title: string };
    bus: { title: string };
    exams: {
      cardView: string;
      empty: string;
      filterAll: string;
      filterCompleted: string;
      filterEmpty: string;
      filterIncomplete: string;
      listView: string;
      noSubscriptionsDescription: string;
      noSubscriptionsTitle: string;
      title: string;
      viewMode: string;
    };
    homeworks: { title: string };
    links: { title: string };
    overview: { title: string };
    subscriptions: { title: string };
    todos: { title: string };
  };
  calendarSemesterNext: string;
  calendarSemesterPrev: string;
  calendarViewMonth: string;
  calendarViewSemester: string;
  calendarViewWeek: string;
  calendarWeek: {
    current: string;
    next: string;
    prev: string;
  };
  completedStatus: string;
  homeworks: {
    empty: string;
  };
  openSlot: string;
  overdue: {
    empty: string;
    title: string;
  };
  radar: {
    empty: string;
  };
  termSelection: {
    browseCourses: string;
    browseSections: string;
    matchByCode: string;
    noAnySelection: string;
    noCurrentTerm: string;
    title: string;
  };
  today: {
    empty: string;
    title: string;
  };
  todos: {
    dueSoon: string;
    dueToday: string;
    pending: string;
    title: string;
  };
  pendingStatus: string;
  week: {
    title: string;
  };
};

export type DashboardSectionCopy = DashboardRecord & {
  dateTBD: string;
  examCount: string;
  examTypeFinal: string;
  examTypeMidterm: string;
  nextMonth: string;
  previousMonth: string;
  weekLabel: string;
  weekNumber: string;
  weekdays: {
    shortFriday: string;
    shortMonday: string;
    shortSaturday: string;
    shortSunday: string;
    shortThursday: string;
    shortTuesday: string;
    shortWednesday: string;
  };
};

export type DashboardSubscriptionsCopy = DashboardRecord & {
  browseCourses: string;
  browseSections: string;
  bulkImport: {
    cancel: string;
    checkFormat: string;
    confirmTitle: string;
    description: string;
    fetchFailed: string;
    importFailed: string;
    importing: string;
    matchButton: string;
    matchedSummary: string;
    matching: string;
    noMatches: string;
    noValidCodes: string;
    placeholder: string;
    sectionCodesLabel: string;
    selectSection: string;
    semesterLabel: string;
    subscribeSelected: string;
    successDescription: string;
    title: string;
    unmatchedCodes: string;
  };
  calendarEmpty: string;
  courseName: string;
  credits: string;
  iCalLink: string;
  linkCopied: string;
  linkCopiedDescription: string;
  noSubscriptions: string;
  noSubscriptionsDescription: string;
  optOut: string;
  optOutConfirm: string;
  optOutError: string;
  optOutRetry: string;
  optOutSuccessDescription: string;
  removing: string;
  rowActions: string;
  section: string;
  sectionsIncluded: string;
  semesterGroup: string;
};

export type DashboardHomeworksCopy = Record<string, string> & {
  completionFailed: string;
  createFailed: string;
  errorDescriptionTooLong: string;
  errorInvalidSubmissionDue: string;
  errorSectionNotFound: string;
  errorTitleRequired: string;
  errorTitleTooLong: string;
  markComplete: string;
  markIncomplete: string;
};

export type DashboardMyHomeworksCopy = Record<string, string> & {
  due: string;
  noSubscriptions: string;
  noSubscriptionsDescription: string;
  section: string;
};

export type DashboardTodosCopy = DashboardRecord & {
  cancel: string;
  contentLabel: string;
  contentPlaceholder: string;
  createAction: string;
  createTitle: string;
  delete: string;
  deleteAriaLabel: string;
  dueAtLabel: string;
  editTitle: string;
  errorContentTooLong: string;
  errorInvalidDueAt: string;
  errorTitleRequired: string;
  errorTitleTooLong: string;
  filterEmptyTitle: string;
  priority: Record<string, string>;
  priorityLabel: string;
  saveChanges: string;
  saveFailed: string;
  saving: string;
  subtitle: string;
  titleLabel: string;
};

export type DashboardHomeworkItem = DashboardRecord & {
  completion?: unknown | null;
  id: string;
  section?: {
    code?: string | null;
    course?: {
      nameCn?: string | null;
      namePrimary?: string | null;
    } | null;
    courseName?: string | null;
    jwId?: number | null;
    semesterName?: string | null;
  } | null;
  submissionDueAt: Date | string | null;
  title: string;
};

export type DashboardTodoItem = DashboardRecord & {
  completed: boolean;
  content?: string | null;
  dueAt?: Date | string | null;
  id: string;
  priority: string;
  title: string;
};

export type DashboardCalendarTodoItem = DashboardRecord & {
  content?: string | null;
  dateKey?: string | null;
  dueAt?: Date | string | null;
  id: string;
  priority: string;
  title: string;
};

export type DashboardTodoPriorityOption = {
  label: string;
  value: string;
};

export type DashboardSessionItem = DashboardRecord & {
  courseName: string;
  endTime: number;
  id: number | string;
  location: string;
  sectionJwId: number | null;
  startTime: number;
};

export type DashboardOverviewExamItem = DashboardRecord & {
  courseName: string;
  date?: Date | string | null;
  endTime?: number | null;
  examMode?: string | null;
  id: number | string;
  rooms?: unknown;
  startTime?: number | null;
};

export type DashboardOverviewUpcomingExamItem = DashboardRecord & {
  courseName: string;
  date: string;
};

export type DashboardOverviewLinkItem = DashboardRecord & {
  description?: string | null;
  icon: string;
  isPinned: boolean;
  slug: string;
  title: string;
};

export type DashboardLinkPinAction = "pin" | "unpin";
export type DashboardLinkPinSubmit = (
  slug: string,
  action: DashboardLinkPinAction,
) => void;

export type DashboardOverviewData = DashboardRecord & {
  calendar?: DashboardCalendarData | null;
  dueToday: DashboardHomeworkItem[];
  hasAnySelection?: boolean;
  hasCurrentTermSelection: boolean;
  pendingHomeworks: DashboardHomeworkItem[];
  todaySessions: DashboardSessionItem[];
};

export type DashboardCalendarData = DashboardRecord & {
  activeCalendarSemesterId: number | null;
  allExams: DashboardOverviewExamItem[];
  allSessions: DashboardSessionItem[];
  calendarSemesterNavList: Array<{ id: number; name?: string | null }>;
  semesterHomeworks: DashboardHomeworkItem[];
  semesterTodos: DashboardCalendarTodoItem[];
  semesterWeeks: string[][];
  todayDate: string;
};

export type DashboardHomeworksData = DashboardRecord & {
  homeworkSummaries: DashboardHomeworkItem[];
  sections: DashboardRecord[];
};

export type DashboardSubscribedSection = DashboardRecord &
  DashboardExamSection & {
    code: string;
    credits?: number | string | null;
    id: number | string;
    jwId: number | string;
    semester?: {
      id?: number | string | null;
      nameCn?: string | null;
      startDate?: string | null;
    } | null;
    teachers: Array<{ namePrimary?: string | null }>;
  };

export type DashboardSubscriptionsData = DashboardRecord & {
  currentSemesterId?: number | null;
  subscriptions: Array<
    DashboardRecord & {
      sections: DashboardSubscribedSection[];
    }
  >;
};

export type DashboardLinksData = DashboardRecord & {
  dashboardLinks: DashboardOverviewLinkItem[];
};

export type DashboardNavStats = DashboardRecord & {
  examsCount: number;
  pendingTodosCount: number;
};

export type DashboardPageData = DashboardRecord & {
  bus?: DashboardBusData | null;
  calendarSubscriptionUrl?: string | null;
  copy: DashboardRootCopy;
  counts?: DashboardRecord | null;
  homeworks?: DashboardHomeworksData | null;
  links?: DashboardLinksData | null;
  locale: string;
  navStats?: DashboardNavStats | null;
  overview?: DashboardOverviewData | null;
  publicLinks?: unknown[] | null;
  referenceNow?: Date | string | null;
  signedIn: boolean;
  subscribedSectionCount?: number | null;
  subscriptions?: DashboardSubscriptionsData | null;
  tab?: string | null;
  todos?: DashboardTodoItem[] | null;
  userMissing?: boolean;
};

export type DashboardActionData =
  | (DashboardRecord & { error?: string })
  | null
  | undefined;

export type SignedDashboardData = DashboardPageData & {
  signedIn: true;
  userMissing?: false;
  navStats: NonNullable<DashboardPageData["navStats"]>;
  overview: DashboardPageData["overview"];
  homeworks: DashboardPageData["homeworks"];
  subscriptions: DashboardPageData["subscriptions"];
  links: DashboardPageData["links"];
  todos: DashboardPageData["todos"];
  bus: DashboardPageData["bus"];
  calendarSubscriptionUrl: DashboardPageData["calendarSubscriptionUrl"];
  subscribedSectionCount: NonNullable<
    DashboardPageData["subscribedSectionCount"]
  >;
};

export type AnonymousDashboardData = DashboardPageData & {
  signedIn: false;
  counts: NonNullable<DashboardPageData["counts"]>;
  publicLinks: NonNullable<DashboardPageData["publicLinks"]>;
};

export type HomeworkItem = NonNullable<
  SignedDashboardData["homeworks"]
>["homeworkSummaries"][number];
export type HomeworkFilter = "incomplete" | "completed" | "all";
export type HomeworkView = "cards" | "list";
export type TodoItem = NonNullable<SignedDashboardData["todos"]>[number];
export type TodoFilter = "incomplete" | "completed" | "all";
export type TodoView = "cards" | "list";
export type ExamView = "cards" | "list";
export type DashboardLinkItem = NonNullable<
  SignedDashboardData["links"]
>["dashboardLinks"][number];
export type LinkView = "grid" | "list";
export type CalendarData = NonNullable<
  NonNullable<SignedDashboardData["overview"]>["calendar"]
>;
export type SubscriptionsData = NonNullable<
  SignedDashboardData["subscriptions"]
>;
export type SubscribedSection =
  SubscriptionsData["subscriptions"][number]["sections"][number];
export type ExamRow = DashboardExamRow<SubscribedSection>;
export type MatchedSection = MatchedSubscriptionSection;
export type SignedLinkGroup = {
  group: DashboardLinkGroup;
  label: string;
  links: DashboardLinkItem[];
};
export type AnonymousLinkGroup = SignedLinkGroup;
export type DashboardViewState = {
  homeworkView: HomeworkView;
  todoView: TodoView;
  examView: ExamView;
  linkView: LinkView;
};

export type DashboardCalendarControllerState = {
  month: string;
  semesterId: number | null;
  view: CalendarView;
  weekStart: string;
};
