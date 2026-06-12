<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import type { DashboardCalendarTabHref } from "./dashboard-calendar-component-types";

export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string | number>,
) => string;
export let pendingTodos: DashboardTodoItem[];
export let todoPriorityClass: (priority: string) => string;
export let todosCopy: DashboardTodosCopy;
export let todosDueSoon: DashboardTodoItem[];
export let todosDueToday: DashboardTodoItem[];
export let todoStatus: (todo: DashboardTodoItem) => string;
</script>

<Card.Root class="border-base-300 bg-base-100">
  <Card.Header>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <Card.Title>
        <a class="no-underline hover:underline" href={dashboardTabHref("todos")}>{dashboardCopy.nav.todos.title}</a>
      </Card.Title>
      <div class="flex flex-wrap justify-end gap-1.5">
        <Badge class="border-warning/40 bg-warning/10 text-warning">
          {formatMessage(dashboardCopy.todos.dueToday, {
            count: todosDueToday.length,
          })}
        </Badge>
        <Badge variant="outline">
          {formatMessage(dashboardCopy.todos.dueSoon, {
            count: todosDueSoon.length,
          })}
        </Badge>
      </div>
    </div>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-2">
      {#each pendingTodos.slice(0, 5) as todo}
        <a
          class="flex items-start justify-between gap-3 rounded-xl border border-base-300 px-3 py-3 text-sm no-underline transition hover:border-primary hover:bg-base-200/50"
          href={dashboardTabHref("todos")}
        >
          <span class="min-w-0">
            <span class="block truncate font-medium">{todo.title}</span>
            <span class="mt-1 flex flex-wrap gap-1.5">
              <Badge class={todoPriorityClass(todo.priority)}>{todosCopy.priority[todo.priority]}</Badge>
              <Badge variant="ghost">{todoStatus(todo)}</Badge>
            </span>
          </span>
          {#if todo.dueAt}
            <span class="shrink-0 text-right text-base-content/60 text-xs">{fmtDate(todo.dueAt)}</span>
          {/if}
        </a>
      {:else}
        <Alert>{todosCopy.filterEmptyTitle}</Alert>
      {/each}
    </div>
  </Card.Content>
</Card.Root>
