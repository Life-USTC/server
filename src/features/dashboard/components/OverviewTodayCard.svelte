<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardHomeworkItem,
  DashboardRootCopy,
  DashboardSessionItem,
  DashboardTodoItem,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { sectionDetailHomeworkPath } from "@/features/section-detail/lib/section-detail-tab";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewSection from "./OverviewSection.svelte";

export let copy: DashboardRootCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let dueTodayHomeworks: DashboardHomeworkItem[];
export let dueTodayTodos: DashboardTodoItem[];
export let fmtDate: (date: Date | string | null | undefined) => string;
export let fmtTime: (time: number) => string;
export let sessionHref: (session: DashboardSessionItem) => string;
export let todaySessions: DashboardSessionItem[];

$: isEmpty =
  todaySessions.length === 0 &&
  dueTodayHomeworks.length === 0 &&
  dueTodayTodos.length === 0;
</script>

<OverviewSection
  href={dashboardTabHref("calendar")}
  title={dashboardCopy.today.title}
>
  {#if isEmpty}
    <SoftEmptyMessage message={dashboardCopy.today.empty} />
  {:else}
    <ul class="divide-y divide-border/60">
      {#each todaySessions as session}
        <li>
          <a
            class="grid gap-0.5 py-2.5 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
            href={sessionHref(session)}
          >
            <span class="font-medium text-sm">{session.courseName}</span>
            <span class="text-muted-foreground text-xs">
              {fmtTime(session.startTime)}-{fmtTime(session.endTime)} · {session.location}
            </span>
          </a>
        </li>
      {/each}
      {#each dueTodayHomeworks as homework}
        <li>
          <a
            class="grid gap-0.5 py-2.5 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
            href={homework.section?.jwId
              ? sectionDetailHomeworkPath(homework.section.jwId, {
                  homeworkId: homework.id,
                })
              : dashboardTabHref("homeworks")}
          >
            <span class="font-medium text-sm">{homework.title}</span>
            <span class="text-muted-foreground text-xs">
              {copy.CalendarEventCard.homework} · {fmtDate(homework.submissionDueAt)}
            </span>
          </a>
        </li>
      {/each}
      {#each dueTodayTodos as todo}
        <li>
          <a
            class="grid gap-0.5 py-2.5 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
            href={dashboardTabHref("todos")}
          >
            <span class="font-medium text-sm">{todo.title}</span>
            <span class="text-muted-foreground text-xs">
              {copy.CalendarEventCard.todo} · {fmtDate(todo.dueAt)}
            </span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</OverviewSection>
