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
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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

  <Card.Root>
    <Card.Header>
      <Card.Title>
        <a class="no-underline hover:underline" href={dashboardTabHref("homeworks")}>{dashboardCopy.overdue.title}</a>
      </Card.Title>
    </Card.Header>
    <Card.Content>
      <Item.Group class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {#each overdueHomeworks as homework}
          <Item.Root variant="outline" size="sm">
            {#snippet child({ props })}
              <a
                href={homework.section?.jwId
                  ? `/sections/${homework.section.jwId}/homework#homework-${homework.id}`
                  : dashboardTabHref("homeworks")}
                {...props}
              >
                <Item.Content>
                  <Item.Title>
                    <Badge variant="secondary">{copy.CalendarEventCard.homework}</Badge>
                    {homework.title}
                  </Item.Title>
                  <Item.Description>{homework.section?.course?.namePrimary ?? commonCopy.sections}</Item.Description>
                </Item.Content>
                <Item.Actions class="text-muted-foreground text-sm">
                  {homeworkEtaLabel(homework.submissionDueAt)}
                </Item.Actions>
              </a>
            {/snippet}
          </Item.Root>
        {/each}
        {#each overdueTodos as todo}
          <Item.Root variant="outline" size="sm">
            {#snippet child({ props })}
              <a href={dashboardTabHref("todos")} {...props}>
                <Item.Content>
                  <Item.Title>
                    <Badge variant="secondary">{copy.CalendarEventCard.todo}</Badge>
                    {todo.title}
                  </Item.Title>
                  <Item.Description class="flex flex-wrap gap-1.5">
                    <Badge class={todoPriorityClass(todo.priority)}>{todosCopy.priority[todo.priority]}</Badge>
                    <Badge variant="ghost">{todoStatus(todo)}</Badge>
                  </Item.Description>
                </Item.Content>
                <Item.Actions class="text-muted-foreground text-sm">
                  {fmtDate(todo.dueAt)}
                </Item.Actions>
              </a>
            {/snippet}
          </Item.Root>
        {/each}
        {#if overdueHomeworks.length === 0 && overdueTodos.length === 0}
          <Empty.Root class="min-h-24 md:col-span-2 xl:col-span-3">
            <Empty.Header>
              <Empty.Title>{dashboardCopy.overdue.empty}</Empty.Title>
            </Empty.Header>
          </Empty.Root>
        {/if}
      </Item.Group>
    </Card.Content>
  </Card.Root>
</div>
