<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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

<Card.Root>
  <Card.Header>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <Card.Title>
        <a class="no-underline hover:underline" href={dashboardTabHref("todos")}>{dashboardCopy.nav.todos.title}</a>
      </Card.Title>
      <div class="flex flex-wrap justify-end gap-1.5">
        <Badge>
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
    <Item.Group>
      {#each pendingTodos.slice(0, 5) as todo}
        <Item.Root variant="outline" size="sm">
          {#snippet child({ props })}
            <a href={dashboardTabHref("todos")} {...props}>
              <Item.Content>
                <Item.Title>{todo.title}</Item.Title>
                <Item.Description class="flex flex-wrap gap-1.5">
                  <Badge class={todoPriorityClass(todo.priority)}>{todosCopy.priority[todo.priority]}</Badge>
                  <Badge variant="ghost">{todoStatus(todo)}</Badge>
                </Item.Description>
              </Item.Content>
              {#if todo.dueAt}
                <Item.Actions class="text-muted-foreground text-xs sm:text-right">{fmtDate(todo.dueAt)}</Item.Actions>
              {/if}
            </a>
          {/snippet}
        </Item.Root>
      {:else}
        <Empty.Root class="min-h-24">
          <Empty.Header>
            <Empty.Title>{todosCopy.filterEmptyTitle}</Empty.Title>
          </Empty.Header>
        </Empty.Root>
      {/each}
    </Item.Group>
  </Card.Content>
</Card.Root>
