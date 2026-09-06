import type { CatalogLinkGroup } from "@/features/catalog-links/lib/catalog-links";
import { dashboardExamRows } from "./dashboard-controller-display";
import {
  type CalendarData,
  type CatalogLinkItem,
  type DashboardPageData,
  type ExamRow,
  type HomeworkItem,
  isSignedDashboardData,
  type SignedDashboardData,
  type TodoFilter,
  type TodoItem,
} from "./dashboard-controller-helpers";
import { groupCatalogLinks } from "./dashboard-link-ui";
import { resolveDashboardTaskFilter } from "./dashboard-task-filter";
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
  dashboardLinkGroupLabels: Record<CatalogLinkGroup, string>;
  data: DashboardPageData;
  dateFallback: string;
  examFilter: ExamFilter;
  linkSearchQuery: string;
  notAvailable: string;
  currentCatalogLinkItems: CatalogLinkItem[];
  currentOverviewLinkItems: CatalogLinkItem[];
  currentTodoItems: TodoItem[];
  todoFilter: TodoFilter;
}) {
  const signedData = isSignedDashboardData(input.data) ? input.data : null;
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
    ? input.currentCatalogLinkItems
    : [];
  const overviewLinkItems = signedData?.overview
    ? input.currentOverviewLinkItems
    : [];

  return {
    calendarData: (signedData?.overview?.calendar ??
      null) as CalendarData | null,
    dashboardLinkItems,
    examRows,
    filteredExamRows: filterExamRows(
      examRows,
      resolveDashboardTaskFilter(
        input.examFilter,
        examRows.some((row) => !row.completed),
      ),
    ),
    filteredTodos: filterTodos(
      todoItems,
      resolveDashboardTaskFilter(
        input.todoFilter,
        todoItems.some((todo) => !todo.completed),
      ),
    ),
    homeworkItems,
    overviewLinkItems,
    signedData,
    signedLinkGroups: signedData?.links
      ? groupCatalogLinks(
          dashboardLinkItems,
          input.linkSearchQuery,
          input.dashboardLinkGroupLabels,
        )
      : [],
    todoItems,
  };
}
