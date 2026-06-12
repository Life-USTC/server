import type { DashboardLinkGroup } from "@/features/dashboard-links/lib/dashboard-links";
import { dashboardExamRows } from "./dashboard-controller-display";
import {
  type AnonymousLinkGroup,
  type CalendarData,
  type DashboardLinkItem,
  type DashboardPageData,
  type ExamRow,
  isAnonymousDashboardData,
  isSignedDashboardData,
  type SignedLinkGroup,
  type TodoFilter,
  type TodoItem,
} from "./dashboard-controller-helpers";
import type { DashboardLinkSearchable } from "./dashboard-link-ui";
import { groupDashboardLinks } from "./dashboard-link-ui";
import type { ExamFilter } from "./exams";
import { filterExamRows } from "./exams";
import { filterTodos } from "./todos";

export function buildDashboardControllerDerivedState(input: {
  dashboardLinkGroupLabels: Record<DashboardLinkGroup, string>;
  data: DashboardPageData;
  dateFallback: string;
  examFilter: ExamFilter;
  linkSearchQuery: string;
  notAvailable: string;
  previousDashboardLinkItems: DashboardLinkItem[];
  previousOverviewLinkItems: DashboardLinkItem[];
  todoFilter: TodoFilter;
}) {
  const signedData = isSignedDashboardData(input.data) ? input.data : null;
  const anonymousData = isAnonymousDashboardData(input.data)
    ? input.data
    : null;
  const homeworkItems = signedData?.homeworks
    ? signedData.homeworks.homeworkSummaries
    : [];
  const todoItems: TodoItem[] = signedData?.todos ? signedData.todos : [];
  const examRows: ExamRow[] = signedData?.subscriptions
    ? dashboardExamRows(signedData.subscriptions, signedData.referenceNow, {
        dateFallback: input.dateFallback,
        notAvailable: input.notAvailable,
      })
    : [];
  const dashboardLinkItems = signedData?.links
    ? signedData.links.dashboardLinks
    : input.previousDashboardLinkItems;
  const overviewLinkItems = signedData?.overview?.overviewLinks
    ? (signedData.overview.overviewLinks as DashboardLinkItem[]).slice(0, 4)
    : input.previousOverviewLinkItems;

  return {
    anonymousData,
    anonymousLinkGroups: anonymousData
      ? (groupDashboardLinks(
          anonymousData.publicLinks as DashboardLinkSearchable[],
          input.linkSearchQuery,
          input.dashboardLinkGroupLabels,
        ) as unknown as AnonymousLinkGroup[])
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
      ? (groupDashboardLinks(
          dashboardLinkItems as unknown as DashboardLinkSearchable[],
          input.linkSearchQuery,
          input.dashboardLinkGroupLabels,
        ) as unknown as SignedLinkGroup[])
      : [],
    todoItems,
  };
}
