import type { DashboardLinkGroup } from "@/features/dashboard-links/lib/dashboard-links";
import { dashboardExamRows } from "./dashboard-controller-display";
import {
  type CalendarData,
  type DashboardLinkItem,
  type DashboardPageData,
  type ExamRow,
  type HomeworkItem,
  isAnonymousDashboardData,
  isSignedDashboardData,
  type SignedDashboardData,
  type TodoFilter,
  type TodoItem,
} from "./dashboard-controller-helpers";
import { groupDashboardLinks } from "./dashboard-link-ui";
import type { ExamFilter } from "./exams";
import { filterExamRows } from "./exams";
import { filterTodos } from "./todos";

export function applyLocalHomeworkItemsToSignedData(
  signedData: SignedDashboardData | null,
  homeworkItems: HomeworkItem[],
) {
  if (!signedData?.homeworks) return signedData;

  return {
    ...signedData,
    homeworks: {
      ...signedData.homeworks,
      homeworkSummaries: homeworkItems,
    },
    navStats: {
      ...signedData.navStats,
      pendingHomeworksCount: homeworkItems.filter((item) => !item.completion)
        .length,
    },
  };
}

export function applyLocalTodoItemsToSignedData(
  signedData: SignedDashboardData | null,
  todoItems: TodoItem[],
) {
  if (!signedData?.todos) return signedData;

  return {
    ...signedData,
    todos: todoItems,
    navStats: {
      ...signedData.navStats,
      pendingTodosCount: todoItems.filter((todo) => !todo.completed).length,
    },
  };
}

export function buildDashboardControllerDerivedState(input: {
  dashboardLinkGroupLabels: Record<DashboardLinkGroup, string>;
  data: DashboardPageData;
  dateFallback: string;
  examFilter: ExamFilter;
  linkSearchQuery: string;
  notAvailable: string;
  currentDashboardLinkItems: DashboardLinkItem[];
  currentOverviewLinkItems: DashboardLinkItem[];
  currentTodoItems: TodoItem[];
  todoFilter: TodoFilter;
}) {
  const signedData = isSignedDashboardData(input.data) ? input.data : null;
  const anonymousData = isAnonymousDashboardData(input.data)
    ? input.data
    : null;
  const homeworkItems = signedData?.homeworks
    ? signedData.homeworks.homeworkSummaries
    : [];
  const todoItems: TodoItem[] = signedData?.todos ? input.currentTodoItems : [];
  const examRows: ExamRow[] = signedData?.subscriptions
    ? dashboardExamRows(signedData.subscriptions, signedData.referenceNow, {
        dateFallback: input.dateFallback,
        notAvailable: input.notAvailable,
      })
    : [];
  const dashboardLinkItems = signedData?.links
    ? input.currentDashboardLinkItems
    : [];
  const overviewLinkItems = signedData?.overview
    ? input.currentOverviewLinkItems
    : [];

  return {
    anonymousData,
    anonymousLinkGroups: anonymousData
      ? groupDashboardLinks(
          anonymousData.publicLinks,
          input.linkSearchQuery,
          input.dashboardLinkGroupLabels,
        )
      : [],
    calendarData: (signedData?.overview?.calendar ??
      null) as CalendarData | null,
    dashboardLinkItems,
    examRows,
    filteredExamRows: filterExamRows(examRows, input.examFilter),
    filteredTodos: filterTodos(todoItems, input.todoFilter),
    homeworkItems,
    overviewLinkItems,
    signedData,
    signedLinkGroups: signedData?.links
      ? groupDashboardLinks(
          dashboardLinkItems,
          input.linkSearchQuery,
          input.dashboardLinkGroupLabels,
        )
      : [],
    todoItems,
  };
}
