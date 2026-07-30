<script lang="ts">
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardHomeworkItem,
  DashboardOverviewExamItem,
  DashboardSectionCopy,
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewExamSummaryCard from "./OverviewExamSummaryCard.svelte";
import OverviewHomeworkSummaryCard from "./OverviewHomeworkSummaryCard.svelte";
import OverviewTodoSummaryCard from "./OverviewTodoSummaryCard.svelte";

export let commonCopy: DashboardCommonCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let sectionCopy: DashboardSectionCopy;
export let todosCopy: DashboardTodosCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let homeworkEtaLabel: (date: Date | string | null | undefined) => string;
export let calendarExamDetail: (exam: DashboardOverviewExamItem) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string | number>,
) => string;
export let todoStatus: (todo: DashboardTodoItem) => string;
export let pendingHomeworks: DashboardHomeworkItem[];
export let pendingTodos: DashboardTodoItem[];
export let todosDueToday: DashboardTodoItem[];
export let todosDueSoon: DashboardTodoItem[];
export let upcomingExams: DashboardOverviewExamItem[];
export let examsCount: number;
export let previewLimit = DASHBOARD_OVERVIEW_PREVIEW_LIMIT;
export let viewAllLabel = "View all";
</script>

<div class="grid gap-4 lg:grid-cols-3">
  <OverviewHomeworkSummaryCard
    {commonCopy}
    {dashboardCopy}
    {dashboardTabHref}
    {fmtDate}
    {homeworkEtaLabel}
    {pendingHomeworks}
    {previewLimit}
    {viewAllLabel}
  />

  <OverviewTodoSummaryCard
    {dashboardCopy}
    {dashboardTabHref}
    {fmtDate}
    {formatMessage}
    {pendingTodos}
    {previewLimit}
    {todosCopy}
    {todosDueSoon}
    {todosDueToday}
    {todoStatus}
    {viewAllLabel}
  />

  <OverviewExamSummaryCard
    {calendarExamDetail}
    {dashboardCopy}
    {dashboardTabHref}
    {examsCount}
    {fmtDate}
    {previewLimit}
    {sectionCopy}
    {upcomingExams}
    {viewAllLabel}
  />
</div>
