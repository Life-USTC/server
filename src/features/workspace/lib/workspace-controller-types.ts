import type { CatalogLinkSearchable } from "@/features/catalog-links/lib/catalog-link-search";
import type {
  CatalogLinkGroup,
  CatalogLinkIcon,
} from "@/features/catalog-links/lib/catalog-links";
import type { DemoView } from "@/features/demo/lib/demo-types";
import type { HomeworkCapabilities } from "@/features/homeworks/lib/homework-capabilities";
import type { SubscriptionKind } from "@/features/subscriptions/lib/subscription-kind";
import type { TodoPriorityValue } from "@/features/todos/lib/todo-priority";
import type { WorkspaceBusData } from "@/features/workspace/lib/bus-tab-types";
import type { CalendarView } from "@/features/workspace/lib/calendar";
import type {
  WorkspaceExamRow,
  WorkspaceExamSection,
} from "@/features/workspace/lib/exams";
import type { MatchedSubscriptionSection } from "@/features/workspace/lib/subscriptions";
import type { AppPageCopy } from "@/lib/shell/page-copy";

type WorkspaceRecord = Record<string, unknown>;

export type WorkspaceRootCopy = AppPageCopy;
export type WorkspaceCommonCopy = AppPageCopy["common"];
export type WorkspaceHomepageCopy = AppPageCopy["homepage"];
export type WorkspaceCopy = AppPageCopy["workspace"];
export type WorkspaceSectionCopy = AppPageCopy["sectionDetail"];
export type WorkspaceSubscriptionsCopy = AppPageCopy["subscriptions"];
export type WorkspaceHomeworksCopy = AppPageCopy["homeworks"];
export type WorkspaceMyHomeworksCopy = AppPageCopy["myHomeworks"];
export type WorkspaceTodosCopy = AppPageCopy["todos"];

export type WorkspaceHomeworkItem = WorkspaceRecord & {
  completion?: unknown | null;
  completionRequired?: boolean;
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
  priority: TodoPriorityValue;
  title: string;
};

export type WorkspaceCalendarTodoItem = WorkspaceRecord & {
  completed?: boolean;
  content?: string | null;
  dateKey?: string | null;
  dueAt?: Date | string | null;
  id: string;
  priority: TodoPriorityValue;
  title: string;
};

export type WorkspaceTodoPriorityOption = {
  label: string;
  value: string;
};

export type WorkspaceSessionItem = WorkspaceRecord & {
  weekIndex?: number | null;
  courseName: string;
  dateKey?: string | null;
  endTime: number;
  id: number | string;
  location: string;
  sectionJwId: number | null;
  sectionCode: string | null;
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
  currentTermName: string | null;
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
  nextClassStarts?: string[];
  semesterEnd?: string | null;
  semesterName?: string | null;
  teacherName?: string | null;
};

export type WorkspaceSubscribedSection = WorkspaceRecord &
  WorkspaceExamSection & {
    kind: SubscriptionKind;
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
  user: { id: string };
  calendarItemsCount: number;
  examsCount: number;
  pendingHomeworksCount: number;
  pendingTodosCount: number;
};

export type WorkspacePageData = WorkspaceRecord & {
  homeworkCapabilities?: HomeworkCapabilities;
  demo?: DemoView | null;
  bus?: WorkspaceBusData | null;
  calendarSubscriptionUrl?: string | null;
  calendarLinkState?: "ready" | "reauthenticate" | "unavailable";
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
export type TodoItem = NonNullable<SignedWorkspaceData["todos"]>[number];
export type CalendarData = WorkspaceCalendarData;
export type SubscriptionsData = NonNullable<
  SignedWorkspaceData["subscriptions"]
>;
export type SubscribedSection =
  SubscriptionsData["subscriptions"][number]["sections"][number];
export type ExamRow = WorkspaceExamRow<SubscribedSection>;
export type MatchedSection = MatchedSubscriptionSection;
export type CatalogLinkGroupEntry = {
  group: CatalogLinkGroup;
  label: string;
  links: CatalogLinkItem[];
};

export type WorkspaceCalendarControllerState = {
  month: string;
  semesterId: number | null;
  view: CalendarView;
  weekStart: string;
};
