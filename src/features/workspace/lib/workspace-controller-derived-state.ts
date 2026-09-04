import type { CatalogLinkGroup } from "@/features/catalog-links/lib/catalog-links";
import type { ExamFilter } from "./exams";
import { filterExamRows } from "./exams";
import { filterTodos } from "./todos";
import { workspaceExamRows } from "./workspace-controller-display";
import {
  type CalendarData,
  type CatalogLinkItem,
  type ExamRow,
  type HomeworkItem,
  isSignedWorkspaceData,
  type SignedWorkspaceData,
  type TodoFilter,
  type TodoItem,
  type WorkspacePageData,
} from "./workspace-controller-helpers";
import { groupCatalogLinks } from "./workspace-link-ui";
import { resolveWorkspaceTaskFilter } from "./workspace-task-filter";

export function applyLocalHomeworkItemsToSignedData(
  signedData: SignedWorkspaceData | null,
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
  signedData: SignedWorkspaceData | null,
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

export function buildWorkspaceControllerDerivedState(input: {
  catalogLinkGroupLabels: Record<CatalogLinkGroup, string>;
  data: WorkspacePageData;
  dateFallback: string;
  examFilter: ExamFilter;
  linkSearchQuery: string;
  notAvailable: string;
  currentCatalogLinkItems: CatalogLinkItem[];
  currentOverviewLinkItems: CatalogLinkItem[];
  currentTodoItems: TodoItem[];
  todoFilter: TodoFilter;
}) {
  const signedData = isSignedWorkspaceData(input.data) ? input.data : null;
  const homeworkItems = signedData?.homeworks
    ? signedData.homeworks.homeworkSummaries
    : [];
  const todoItems: TodoItem[] = signedData?.todos ? input.currentTodoItems : [];
  const examRows: ExamRow[] = signedData?.subscriptions
    ? workspaceExamRows(signedData.subscriptions, signedData.referenceNow, {
        dateFallback: input.dateFallback,
        notAvailable: input.notAvailable,
      })
    : [];
  const catalogLinkItems = signedData?.links
    ? input.currentCatalogLinkItems
    : [];
  const overviewLinkItems = signedData?.overview
    ? input.currentOverviewLinkItems
    : [];

  return {
    calendarData: (signedData?.overview?.calendar ??
      null) as CalendarData | null,
    catalogLinkItems,
    examRows,
    filteredExamRows: filterExamRows(
      examRows,
      resolveWorkspaceTaskFilter(
        input.examFilter,
        examRows.some((row) => !row.completed),
      ),
    ),
    filteredTodos: filterTodos(
      todoItems,
      resolveWorkspaceTaskFilter(
        input.todoFilter,
        todoItems.some((todo) => !todo.completed),
      ),
    ),
    homeworkItems,
    overviewLinkItems,
    signedData,
    signedLinkGroups: signedData?.links
      ? groupCatalogLinks(
          catalogLinkItems,
          input.linkSearchQuery,
          input.catalogLinkGroupLabels,
        )
      : [],
    todoItems,
  };
}
