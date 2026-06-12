<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardHomeworkItem,
  DashboardRootCopy,
  DashboardSessionItem,
  DashboardTodoItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Alert } from "$lib/components/ui/alert/index.js";
import * as Card from "$lib/components/ui/card/index.js";
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

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <Card.Title>
      <a class="no-underline hover:underline" href={dashboardTabHref("calendar")}>{dashboardCopy.today.title}</a>
    </Card.Title>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-2 md:grid-cols-2">
      {#each todaySessions as session}
        <a
          href={sessionHref(session)}
          class="rounded-xl border border-base-300 px-3 py-3 text-sm no-underline transition hover:border-primary hover:bg-base-200/50"
        >
          <div class="font-medium">{session.courseName}</div>
          <div class="text-base-content/60 text-sm">
            {fmtTime(session.startTime)}-{fmtTime(session.endTime)} · {session.location}
          </div>
        </a>
      {/each}
      {#each dueTodayHomeworks as homework}
        <a
          class="rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 text-sm no-underline transition hover:border-warning"
          href={homework.section?.jwId
            ? `/sections/${homework.section.jwId}#homework-${homework.id}`
            : dashboardTabHref("homeworks")}
        >
          <div class="font-medium">{homework.title}</div>
          <div class="text-base-content/60 text-sm">{copy.CalendarEventCard.homework} · {fmtDate(homework.submissionDueAt)}</div>
        </a>
      {/each}
      {#each dueTodayTodos as todo}
        <a
          class="rounded-xl border border-success/30 bg-success/10 px-3 py-3 text-sm no-underline transition hover:border-success"
          href={dashboardTabHref("todos")}
        >
          <div class="font-medium">{todo.title}</div>
          <div class="text-base-content/60 text-sm">{copy.CalendarEventCard.todo} · {fmtDate(todo.dueAt)}</div>
        </a>
      {/each}
      {#if todaySessions.length === 0 && dueTodayHomeworks.length === 0 && dueTodayTodos.length === 0}
        <Alert>{dashboardCopy.today.empty}</Alert>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
