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
export let todoPriorityClass: (priority: string) => string;
export let todoStatus: (todo: DashboardTodoItem) => string;
export let pendingHomeworks: DashboardHomeworkItem[];
export let pendingTodos: DashboardTodoItem[];
export let todosDueToday: DashboardTodoItem[];
export let todosDueSoon: DashboardTodoItem[];
export let upcomingExams: DashboardOverviewExamItem[];
export let examsCount: number;
</script>

<div class="grid gap-4 lg:grid-cols-3">
  <OverviewHomeworkSummaryCard
    {commonCopy}
    {dashboardCopy}
    {dashboardTabHref}
    {fmtDate}
    {homeworkEtaLabel}
    {pendingHomeworks}
  />

  <OverviewTodoSummaryCard
    {dashboardCopy}
    {dashboardTabHref}
    {fmtDate}
    {formatMessage}
    {pendingTodos}
    {todoPriorityClass}
    {todosCopy}
    {todosDueSoon}
    {todosDueToday}
    {todoStatus}
  />

  <OverviewExamSummaryCard
    {calendarExamDetail}
    {dashboardCopy}
    {dashboardTabHref}
    {examsCount}
    {fmtDate}
    {sectionCopy}
    {upcomingExams}
  />
</div>
