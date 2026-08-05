<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";
import OverviewSection from "./OverviewSection.svelte";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string | number>,
) => string;
export let pendingTodos: DashboardTodoItem[];
export let todosCopy: DashboardTodosCopy;
export let todosDueSoon: DashboardTodoItem[];
export let todosDueToday: DashboardTodoItem[];
export let todoStatus: (todo: DashboardTodoItem) => string;
export let previewLimit = DASHBOARD_OVERVIEW_PREVIEW_LIMIT;
export let viewAllLabel = "View all";
</script>

<OverviewSection
  href={dashboardTabHref("todos")}
  title={dashboardCopy.todos.title}
  viewAllHref={dashboardTabHref("todos")}
  viewAllLabel={viewAllLabel}
  viewAllVisible={pendingTodos.length > previewLimit}
>
  {#snippet action()}
    <div class="flex flex-wrap gap-1.5 text-muted-foreground text-xs">
      <span>
        {formatMessage(dashboardCopy.todos.dueToday, {
          count: todosDueToday.length,
        })}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {formatMessage(dashboardCopy.todos.dueSoon, {
          count: todosDueSoon.length,
        })}
      </span>
    </div>
  {/snippet}

  {#if pendingTodos.length === 0}
    <SoftEmptyMessage message={todosCopy.filterEmptyTitle} />
  {:else}
    <ul class="divide-y divide-border/60">
      {#each pendingTodos.slice(0, previewLimit) as todo}
        <li>
          <a
            class="flex items-start justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40 -mx-2 px-2 rounded-md"
            href={dashboardTabHref("todos")}
          >
            <span class="grid min-w-0 gap-1">
              <span class="font-medium text-sm">{todo.title}</span>
              <span class="flex flex-wrap gap-1.5">
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
            {#if todo.dueAt}
              <span class="shrink-0 text-muted-foreground text-xs tabular-nums">
                {fmtDate(todo.dueAt)}
              </span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</OverviewSection>
