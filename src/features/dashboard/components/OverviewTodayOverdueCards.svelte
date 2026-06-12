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
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewTodayCard from "./OverviewTodayCard.svelte";

export let copy: DashboardRootCopy;
export let commonCopy: DashboardCommonCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let todosCopy: DashboardTodosCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let fmtTime: (time: number) => string;
export let homeworkEtaLabel: (date: Date | string | null | undefined) => string;
export let sessionHref: (session: DashboardSessionItem) => string;
export let todoPriorityClass: (priority: string) => string;
export let todoStatus: (todo: DashboardTodoItem) => string;
export let todaySessions: DashboardSessionItem[];
export let dueTodayHomeworks: DashboardHomeworkItem[];
export let dueTodayTodos: DashboardTodoItem[];
export let overdueHomeworks: DashboardHomeworkItem[];
export let overdueTodos: DashboardTodoItem[];
</script>

<div class="grid gap-4 lg:grid-cols-2">
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

  <Card.Root class="border-base-300 bg-base-100">
    <Card.Header>
      <Card.Title>
        <a class="no-underline hover:underline" href={dashboardTabHref("homeworks")}>{dashboardCopy.overdue.title}</a>
      </Card.Title>
    </Card.Header>
    <Card.Content>
      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {#each overdueHomeworks as homework}
          <a
            class="flex items-start justify-between gap-3 rounded-xl border border-base-300 px-3 py-3 text-sm no-underline transition hover:border-primary hover:bg-base-200/50"
            href={homework.section?.jwId
              ? `/sections/${homework.section.jwId}#homework-${homework.id}`
              : dashboardTabHref("homeworks")}
          >
            <span class="min-w-0">
              <span class="mb-1 inline-flex text-base-content/55 text-xs">{copy.CalendarEventCard.homework}</span>
              <span class="block truncate font-medium">{homework.title}</span>
              <span class="block truncate text-base-content/60 text-sm">{homework.section?.course?.namePrimary ?? commonCopy.sections}</span>
            </span>
            <span class="shrink-0 text-base-content/60 text-sm">{homeworkEtaLabel(homework.submissionDueAt)}</span>
          </a>
        {/each}
        {#each overdueTodos as todo}
          <a
            class="flex items-start justify-between gap-3 rounded-xl border border-base-300 px-3 py-3 text-sm no-underline transition hover:border-primary hover:bg-base-200/50"
            href={dashboardTabHref("todos")}
          >
            <span class="min-w-0">
              <span class="mb-1 inline-flex text-base-content/55 text-xs">{copy.CalendarEventCard.todo}</span>
              <span class="block truncate font-medium">{todo.title}</span>
              <span class="mt-1 flex flex-wrap gap-1.5">
                <Badge class={todoPriorityClass(todo.priority)}>{todosCopy.priority[todo.priority]}</Badge>
                <Badge variant="ghost">{todoStatus(todo)}</Badge>
              </span>
            </span>
            <span class="shrink-0 text-base-content/60 text-sm">{fmtDate(todo.dueAt)}</span>
          </a>
        {/each}
        {#if overdueHomeworks.length === 0 && overdueTodos.length === 0}
          <Alert>{dashboardCopy.overdue.empty}</Alert>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
</div>
