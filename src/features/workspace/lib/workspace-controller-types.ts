import type { CatalogLinkSearchable } from "@/features/catalog-links/lib/catalog-link-search";
import type {
  CatalogLinkGroup,
  CatalogLinkIcon,
} from "@/features/catalog-links/lib/catalog-links";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type { HomeworkStyleGuideCopy } from "@/features/homeworks/lib/homework-style-guide";
import type {
  WorkspaceBusCopy,
  WorkspaceBusData,
} from "@/features/workspace/lib/bus-tab-types";
import type { CalendarView } from "@/features/workspace/lib/calendar";
import type {
  WorkspaceExamRow,
  WorkspaceExamSection,
} from "@/features/workspace/lib/exams";
import type { MatchedSubscriptionSection } from "@/features/workspace/lib/subscriptions";

type WorkspaceRecord = Record<string, unknown>;

export type WorkspaceCommonCopy = WorkspaceRecord & {
  courses: string;
  next: string;
  previous: string;
  semesters: string;
  sections: string;
  userNotFound: string;
};

export type WorkspaceHomepageCopy = WorkspaceRecord & {
  actions: {
    mobileApp: string;
    openWorkspace: string;
    signIn: string;
  };
  appIconAlt: string;
  publicWorkspace: {
    cards: {
      bus: { description: string; title: string };
      courses: { description: string; title: string };
      links: { description: string; title: string };
      mobileApp: { description: string; title: string };
      sections: { description: string; title: string };
      signIn: { description: string; title: string };
      teachers: { description: string; title: string };
    };
    description: string;
    exploreLabel: string;
    title: string;
  };
  subtitle: string;
  title: {
    line1: string;
    line2: string;
  };
};

export type WorkspaceRootCopy = WorkspaceRecord & {
  CalendarEventCard: {
    exam: string;
    homework: string;
    todo: string;
  };
  bus: WorkspaceBusCopy;
  comments: CommentsCopy;
  common: WorkspaceCommonCopy;
  workspace: WorkspaceCopy;
  homepage: WorkspaceHomepageCopy;
  homeworks: WorkspaceHomeworksCopy;
  myHomeworks: WorkspaceMyHomeworksCopy;
  sectionDetail: WorkspaceSectionCopy;
  subscriptions: WorkspaceSubscriptionsCopy;
  todos: WorkspaceTodosCopy;
  metadata: {
    home: string;
  };
};

export type WorkspaceCopy = WorkspaceRecord & {
  linkHub: {
    colActions: string;
    colDescription: string;
    colName: string;
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
    title: string;
    unpin: string;
    viewMode: string;
  };
  moreItems: string;
  notAvailable: string;
  nav: {
    ariaLabel: string;
    calendar: { title: string };
    bus: { description: string; title: string };
    exams: {
      cardView: string;
      clearFilter: string;
      empty: string;
      emptyDescription: string;
      filterAll: string;
      filterCompleted: string;
      filterEmpty: string;
      filterEmptyDescription: string;
      filterIncomplete: string;
      listView: string;
      noSubscriptionsDescription: string;
      noSubscriptionsTitle: string;
      title: string;
      viewMode: string;
    };
    homeworks: { title: string };
    links: { description: string; title: string };
    overview: { title: string };
    subscriptions: { title: string };
    todos: { title: string };
  };
  calendarSemesterNext: string;
  calendarSemesterPrev: string;
  calendarAgendaEmpty: string;
  calendarAgendaLabel: string;
  calendarMoreActions: string;
  calendarViewMonth: string;
  calendarViewSemester: string;
  calendarViewWeek: string;
  calendarWeek: {
    current: string;
    next: string;
    prev: string;
  };
  completedStatus: string;
  focus: {
    next: string;
    noUpcoming: string;
    now: string;
    title: string;
    urgent: string;
  };
  homeworks: {
    empty: string;
    titleV2: string;
  };
  openSlot: string;
  overdue: {
    empty: string;
    title: string;
  };
  radar: {
    empty: string;
    title: string;
  };
  termSelection: {
    browseCourses: string;
    browseSections: string;
    historyAvailable: string;
    matchByCode: string;
    noAnySelection: string;
    noCurrentTerm: string;
    title: string;
    viewPastHomeworks: string;
    viewPastSchedule: string;
    viewPastSections: string;
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
  todayAction: string;
  week: {
    title: string;
  };
};

export type WorkspaceSectionCopy = WorkspaceRecord & {
  calendarSheetDescription: string;
  calendarSheetTitle: string;
  close: string;
  copied: string;
  copyToClipboard: string;
  dateTBD: string;
  examDate: string;
  examDateTBD: string;
  examCount: string;
  examTime: string;
  examTypeFinal: string;
  examTypeMidterm: string;
  learnMoreAboutICalendar: string;
  moreDetails: string;
  nextMonth: string;
  noTeachersListed: string;
  previousMonth: string;
  room: string;
  roomTbd: string;
  subscriptionMissing: string;
  subscriptionPrivacyNote: string;
  subscriptionUrlDescription: string;
  subscriptionUrlLabel: string;
  viewAllSubscriptions: string;
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

export type WorkspaceSubscriptionsCopy = WorkspaceRecord & {
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
    semesterPlaceholder: string;
    subscribeSelected: string;
    successDescription: string;
    title: string;
    unmatchedCodes: string;
  };
  quickAdd: {
    alreadySubscribed: string;
    cancel: string;
    codeLabel: string;
    description: string;
    emptyDescription: string;
    emptyTitle: string;
    hint: string;
    placeholder: string;
    resultsDescription: string;
    resultsLabel: string;
    searchButton: string;
    searching: string;
    selectSection: string;
    subscribeSelected: string;
    subscribing: string;
    title: string;
  };
  calendarEmpty: string;
  cancelUnsubscribe: string;
  closeDetails: string;
  confirmUnsubscribe: string;
  courseName: string;
  credits: string;
  detailsDescription: string;
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
  openCourse: string;
  openDetails: string;
  removing: string;
  rowActions: string;
  section: string;
  sectionIncluded: string;
  sectionsIncluded: string;
  semester: string;
  semesterGroup: string;
  unsubscribe: string;
  unsubscribeDescription: string;
  unsubscribeTitle: string;
};

export interface WorkspaceHomeworksCopy extends HomeworkStyleGuideCopy {
  [key: string]: string;
  advancedHide: string;
  advancedShow: string;
  calendarButtonLabel: string;
  cancel: string;
  completedLabel: string;
  commentsLabel: string;
  commentsTitle: string;
  completionFailed: string;
  createAction: string;
  createFailed: string;
  createTitle: string;
  descriptionEmpty: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  dueDateShortcuts: string;
  errorDescriptionTooLong: string;
  errorInvalidSubmissionDue: string;
  errorSectionNotFound: string;
  errorTitleRequired: string;
  errorTitleTooLong: string;
  helperClear: string;
  helperMonth: string;
  helperPublishNow: string;
  helperSemesterEnd: string;
  helperStartNow: string;
  helperWeek: string;
  homeworkPublishedAt: string;
  markComplete: string;
  markIncomplete: string;
  moreDetails: string;
  pendingLabel: string;
  publishedAt: string;
  relativeTime: string;
  saving: string;
  sectionLabel: string;
  statusLabel: string;
  submissionDue: string;
  submissionStart: string;
  subtitle: string;
  tagMajor: string;
  tagTeam: string;
  titleLabel: string;
  titlePlaceholder: string;
  viewDetails: string;
}

export type WorkspaceMyHomeworksCopy = Record<string, string> & {
  due: string;
  noSubscriptions: string;
  noSubscriptionsDescription: string;
  section: string;
};

export type WorkspaceTodosCopy = WorkspaceRecord & {
  calendarButtonLabel: string;
  cancel: string;
  contentLabel: string;
  contentEmpty: string;
  contentPlaceholder: string;
  createAction: string;
  createTitle: string;
  completeSuccess: string;
  delete: string;
  deleteSuccess: string;
  deleteAriaLabel: string;
  deleteConfirmDescription: string;
  deleteConfirmTitle: string;
  dueAtLabel: string;
  dueAtPlaceholder: string;
  editAriaLabel: string;
  editDescription: string;
  editTitle: string;
  errorContentTooLong: string;
  errorInvalidDueAt: string;
  errorTitleRequired: string;
  errorTitleTooLong: string;
  filterEmptyTitle: string;
  markComplete: string;
  markIncomplete: string;
  priority: Record<string, string>;
  priorityLabel: string;
  saveChanges: string;
  saveFailed: string;
  uncompleteSuccess: string;
  saving: string;
  subtitle: string;
  titleLabel: string;
  titlePlaceholder: string;
};

export type WorkspaceHomeworkItem = WorkspaceRecord & {
  completion?: unknown | null;
  completed?: boolean;
  dateKey?: string | null;
  description?: string | null;
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

export type WorkspaceTodoItem = WorkspaceRecord & {
  completed: boolean;
  content?: string | null;
  dueAt?: Date | string | null;
  id: string;
  priority: string;
  title: string;
};

export type WorkspaceCalendarTodoItem = WorkspaceRecord & {
  completed?: boolean;
  content?: string | null;
  dateKey?: string | null;
  dueAt?: Date | string | null;
  id: string;
  priority: string;
  title: string;
};

export type WorkspaceTodoPriorityOption = {
  label: string;
  value: string;
};

export type WorkspaceSessionItem = WorkspaceRecord & {
  courseName: string;
  dateKey?: string | null;
  endTime: number;
  id: number | string;
  location: string;
  sectionJwId: number | null;
  startTime: number;
  teacherDisplay?: string | null;
};

export type WorkspaceOverviewExamItem = WorkspaceRecord & {
  courseName: string;
  date?: Date | string | null;
  dateKey?: string | null;
  endTime?: number | null;
  examMode?: string | null;
  id: number | string;
  rooms?: unknown;
  startTime?: number | null;
};

export type WorkspaceOverviewUpcomingExamItem = WorkspaceRecord & {
  courseName: string;
  date: string;
};

export type CatalogLinkItem = WorkspaceRecord &
  CatalogLinkSearchable & {
    clickCount: number;
    icon: CatalogLinkIcon;
    isPinned: boolean;
    slug: string;
    url: string;
  };

export type WorkspaceOverviewLinkItem = CatalogLinkItem;

export type WorkspaceLinkPinAction = "pin" | "unpin";
export type WorkspaceLinkPinSubmit = (
  slug: string,
  action: WorkspaceLinkPinAction,
) => void;

export type WorkspaceOverviewData = WorkspaceRecord & {
  calendar?: WorkspaceCalendarData | WorkspaceCalendarPreviewData | null;
  dueToday: WorkspaceHomeworkItem[];
  hasAnySelection?: boolean;
  hasCurrentTermSelection: boolean;
  overviewLinks: WorkspaceOverviewLinkItem[];
  pendingHomeworks: WorkspaceHomeworkItem[];
  todaySessions: WorkspaceSessionItem[];
};

export type WorkspaceCalendarPreviewData = WorkspaceRecord & {
  allExams: WorkspaceOverviewExamItem[];
  allSessions: WorkspaceSessionItem[];
  calendarSemesterPicker: Array<{ id: number; name?: string | null }>;
  semesterHomeworks: WorkspaceHomeworkItem[];
  semesterTodos: WorkspaceCalendarTodoItem[];
  todayDate: string;
};

export type WorkspaceCalendarData = WorkspaceCalendarPreviewData & {
  activeCalendarSemesterId: number | null;
  activeCalendarSemesterName?: string | null;
  calendarSemesterNavList: Array<{ id: number; name?: string | null }>;
  semesterWeeks: string[][];
};

export type WorkspaceHomeworksData = WorkspaceRecord & {
  homeworkSummaries: WorkspaceHomeworkItem[];
  sections: WorkspaceHomeworkSectionOption[];
};

export type WorkspaceHomeworkSectionOption = WorkspaceRecord & {
  code?: string | null;
  course?: {
    code?: string | null;
    name?: string | null;
  } | null;
  courseCode?: string | null;
  courseName?: string | null;
  id: number | string;
  semesterEnd?: string | null;
  semesterName?: string | null;
  teacherName?: string | null;
};

export type WorkspaceSubscribedSection = WorkspaceRecord &
  WorkspaceExamSection & {
    code: string;
    credits?: number | string | null;
    id: number;
    jwId: number;
    course: WorkspaceExamSection["course"] & {
      code?: string | null;
      jwId?: number | null;
    };
    semester?: {
      endDate?: string | null;
      id?: number | string | null;
      nameCn?: string | null;
      startDate?: string | null;
    } | null;
    teachers: Array<{ namePrimary?: string | null }>;
  };

export type WorkspaceSubscriptionsData = WorkspaceRecord & {
  currentSemesterId?: number | null;
  subscriptions: Array<
    WorkspaceRecord & {
      sections: WorkspaceSubscribedSection[];
    }
  >;
};

export type CatalogLinksData = WorkspaceRecord & {
  catalogLinks: CatalogLinkItem[];
};

export type WorkspaceNavStats = WorkspaceRecord & {
  calendarItemsCount: number;
  examsCount: number;
  pendingHomeworksCount: number;
  pendingTodosCount: number;
};

export type WorkspacePageData = WorkspaceRecord & {
  bus?: WorkspaceBusData | null;
  calendarSubscriptionUrl?: string | null;
  copy: WorkspaceRootCopy;
  homeworks?: WorkspaceHomeworksData | null;
  links?: CatalogLinksData | null;
  locale: string;
  mainContentLabel?: string | null;
  navStats?: WorkspaceNavStats | null;
  overview?: WorkspaceOverviewData | null;
  publicLinks?: CatalogLinkItem[] | null;
  referenceNow?: Date | string | null;
  signedIn: boolean;
  subscribedSectionCount?: number | null;
  subscriptions?: WorkspaceSubscriptionsData | null;
  tab?: string | null;
  todos?: WorkspaceTodoItem[] | null;
  userMissing?: boolean;
};

export type WorkspaceActionData =
  | (WorkspaceRecord & { error?: string })
  | null
  | undefined;

export type SignedWorkspaceData = WorkspacePageData & {
  mainContentLabel: string;
  signedIn: true;
  userMissing?: false;
  navStats: NonNullable<WorkspacePageData["navStats"]>;
  overview: WorkspacePageData["overview"];
  homeworks: WorkspacePageData["homeworks"];
  subscriptions: WorkspacePageData["subscriptions"];
  links: WorkspacePageData["links"];
  todos: WorkspacePageData["todos"];
  bus: WorkspacePageData["bus"];
  calendarSubscriptionUrl: WorkspacePageData["calendarSubscriptionUrl"];
  subscribedSectionCount: NonNullable<
    WorkspacePageData["subscribedSectionCount"]
  >;
};

export type HomeworkItem = NonNullable<
  SignedWorkspaceData["homeworks"]
>["homeworkSummaries"][number];
export type HomeworkFilter = "incomplete" | "completed" | "all";
export type HomeworkView = "cards" | "list";
export type TodoItem = NonNullable<SignedWorkspaceData["todos"]>[number];
export type TodoFilter = "incomplete" | "completed" | "all";
export type TodoView = "cards" | "list";
export type ExamView = "cards" | "list";
export type LinkView = "grid" | "list";
export type CalendarData = WorkspaceCalendarData;
export type SubscriptionsData = NonNullable<
  SignedWorkspaceData["subscriptions"]
>;
export type SubscribedSection =
  SubscriptionsData["subscriptions"][number]["sections"][number];
export type ExamRow = WorkspaceExamRow<SubscribedSection>;
export type MatchedSection = MatchedSubscriptionSection;
export type SignedLinkGroup = {
  group: CatalogLinkGroup;
  label: string;
  links: CatalogLinkItem[];
};
export type AnonymousLinkGroup = SignedLinkGroup;
export type WorkspaceViewState = {
  homeworkView: HomeworkView;
  todoView: TodoView;
  examView: ExamView;
  linkView: LinkView;
};

export type WorkspaceCalendarControllerState = {
  month: string;
  semesterId: number | null;
  view: CalendarView;
  weekStart: string;
};
