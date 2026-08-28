<script lang="ts">
import type {
  DashboardDashboardCopy,
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/dashboard/lib/overview-preview";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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
    <Empty.Root class="min-h-20 border-0 px-2 py-6">
      <Empty.Header>
        <Empty.Description>{todosCopy.filterEmptyTitle}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    {@const todoPreview = pendingTodos.slice(0, previewLimit)}
    <Item.Group class="gap-0">
      {#each todoPreview as todo, index (todo.id)}
        <Item.Root class="rounded-md border-0 px-2 py-2.5" size="sm">
          {#snippet child({ props })}
            <a href={dashboardTabHref("todos")} {...props}>
              <Item.Content class="min-w-0">
                <Item.Title>{todo.title}</Item.Title>
                <Item.Description class="flex flex-wrap gap-1.5">
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
                </Item.Description>
              </Item.Content>
              {#if todo.dueAt}
                <Item.Actions class="shrink-0">
                  <span class="text-muted-foreground text-xs tabular-nums">
                    {fmtDate(todo.dueAt)}
                  </span>
                </Item.Actions>
              {/if}
            </a>
          {/snippet}
        </Item.Root>
        {#if index < todoPreview.length - 1}<Item.Separator class="my-0" />{/if}
      {/each}
    </Item.Group>
  {/if}
</OverviewSection>
