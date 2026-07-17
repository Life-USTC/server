<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardHomeworkItem,
  DashboardRootCopy,
  DashboardSessionItem,
  DashboardTodoItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let copy: DashboardRootCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let dueTodayHomeworks: DashboardHomeworkItem[];
export let dueTodayTodos: DashboardTodoItem[];
export let fmtDate: (date: Date | string | null | undefined) => string;
export let fmtTime: (time: number) => string;
export let sessionHref: (session: DashboardSessionItem) => string;
export let todaySessions: DashboardSessionItem[];
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>
      <a class="no-underline hover:underline" href={dashboardTabHref("calendar")}>{dashboardCopy.today.title}</a>
    </Card.Title>
  </Card.Header>
  <Card.Content>
    <Item.Group class="grid gap-2 md:grid-cols-2">
      {#each todaySessions as session}
        <Item.Root variant="outline" size="sm">
          {#snippet child({ props })}
            <a href={sessionHref(session)} {...props}>
              <Item.Content>
                <Item.Title>{session.courseName}</Item.Title>
                <Item.Description>
                  {fmtTime(session.startTime)}-{fmtTime(session.endTime)} · {session.location}
                </Item.Description>
              </Item.Content>
            </a>
          {/snippet}
        </Item.Root>
      {/each}
      {#each dueTodayHomeworks as homework}
        <Item.Root variant="muted" size="sm">
          {#snippet child({ props })}
            <a
              href={homework.section?.jwId
                ? `/sections/${homework.section.jwId}/homework#homework-${homework.id}`
                : dashboardTabHref("homeworks")}
              {...props}
            >
              <Item.Content>
                <Item.Title>{homework.title}</Item.Title>
                <Item.Description>{copy.CalendarEventCard.homework} · {fmtDate(homework.submissionDueAt)}</Item.Description>
              </Item.Content>
            </a>
          {/snippet}
        </Item.Root>
      {/each}
      {#each dueTodayTodos as todo}
        <Item.Root variant="muted" size="sm">
          {#snippet child({ props })}
            <a href={dashboardTabHref("todos")} {...props}>
              <Item.Content>
                <Item.Title>{todo.title}</Item.Title>
                <Item.Description>{copy.CalendarEventCard.todo} · {fmtDate(todo.dueAt)}</Item.Description>
              </Item.Content>
            </a>
          {/snippet}
        </Item.Root>
      {/each}
      {#if todaySessions.length === 0 && dueTodayHomeworks.length === 0 && dueTodayTodos.length === 0}
        <Empty.Root class="py-2 md:col-span-2">
          <Empty.Header>
            <Empty.Title>{dashboardCopy.today.empty}</Empty.Title>
          </Empty.Header>
        </Empty.Root>
      {/if}
    </Item.Group>
  </Card.Content>
</Card.Root>
