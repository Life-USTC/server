<script lang="ts">
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardHomeworkItem,
  DashboardRootCopy,
  DashboardSessionItem,
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import { sectionDetailHomeworkPath } from "@/features/section-detail/lib/section-detail-tab";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewSection from "./OverviewSection.svelte";
import OverviewTodayCard from "./OverviewTodayCard.svelte";

export let copy: DashboardRootCopy;
export let commonCopy: DashboardCommonCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let todosCopy: DashboardTodosCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let fmtTime: (time: number) => string;
export let homeworkEtaLabel: (date: Date | string | null | undefined) => string;
export let todoStatus: (todo: DashboardTodoItem) => string;
export let todaySessions: DashboardSessionItem[];
export let dueTodayHomeworks: DashboardHomeworkItem[];
export let dueTodayTodos: DashboardTodoItem[];
export let overdueHomeworks: DashboardHomeworkItem[];
export let overdueTodos: DashboardTodoItem[];
export let sessionHref: (session: DashboardSessionItem) => string;
export let previewLimit = DASHBOARD_OVERVIEW_PREVIEW_LIMIT;
export let viewAllLabel = "View all";

$: overdueHomeworkPreview = overdueHomeworks.slice(0, previewLimit);
$: overdueTodoPreview = overdueTodos.slice(
  0,
  Math.max(0, previewLimit - overdueHomeworkPreview.length),
);
$: showOverdueViewAll =
  overdueHomeworks.length + overdueTodos.length > previewLimit;
$: overdueEmpty = overdueHomeworks.length === 0 && overdueTodos.length === 0;
</script>

<div class="grid items-start gap-8 lg:grid-cols-2">
  <OverviewTodayCard
    {copy}
    {dashboardCopy}
    {dashboardTabHref}
    {dueTodayHomeworks}
    {dueTodayTodos}
    {fmtDate}
    {fmtTime}
    {sessionHref}
    {todaySessions}
  />

  <OverviewSection
    href={dashboardTabHref("homeworks")}
    title={dashboardCopy.overdue.title}
    viewAllHref={dashboardTabHref("homeworks")}
    viewAllLabel={viewAllLabel}
    viewAllVisible={showOverdueViewAll}
  >
    {#if overdueEmpty}
      <SoftEmptyMessage message={dashboardCopy.overdue.empty} />
    {:else}
      <ul class="divide-y divide-border/60">
        {#each overdueHomeworkPreview as homework}
          <li>
            <a
              class="flex items-start justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
              href={homework.section?.jwId
                ? sectionDetailHomeworkPath(homework.section.jwId, {
                    homeworkId: homework.id,
                  })
                : dashboardTabHref("homeworks")}
            >
              <span class="grid min-w-0 gap-1">
                <span class="line-clamp-2 font-medium text-sm">{homework.title}</span>
                <span class="flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
                  <Badge variant="secondary">{copy.CalendarEventCard.homework}</Badge>
                  <span>{homework.section?.course?.namePrimary ?? commonCopy.sections}</span>
                </span>
              </span>
              <span class="shrink-0 text-muted-foreground text-xs tabular-nums">
                {homeworkEtaLabel(homework.submissionDueAt)}
              </span>
            </a>
          </li>
        {/each}
        {#each overdueTodoPreview as todo}
          <li>
            <a
              class="flex items-start justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
              href={dashboardTabHref("todos")}
            >
              <span class="grid min-w-0 gap-1">
                <span class="line-clamp-2 font-medium text-sm">{todo.title}</span>
                <span class="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{copy.CalendarEventCard.todo}</Badge>
                  <Badge
                    variant={todo.priority === "high"
                      ? "destructive"
                      : todo.priority === "medium"
                        ? "secondary"
                        : "outline"}
                  >
                    {todosCopy.priority[todo.priority]}
                  </Badge>
                  <Badge variant="ghost">{todoStatus(todo)}</Badge>
                </span>
              </span>
              <span class="shrink-0 text-muted-foreground text-xs tabular-nums">
                {fmtDate(todo.dueAt)}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </OverviewSection>
</div>
