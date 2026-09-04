<script lang="ts">
import { WORKSPACE_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import type {
  WorkspaceCopy,
  WorkspaceTodoItem,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import OverviewSection from "./OverviewSection.svelte";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let workspaceCopy: WorkspaceCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string | number>,
) => string;
export let pendingTodos: WorkspaceTodoItem[];
export let todosCopy: WorkspaceTodosCopy;
export let todosDueSoon: WorkspaceTodoItem[];
export let todosDueToday: WorkspaceTodoItem[];
export let todoStatus: (todo: WorkspaceTodoItem) => string;
export let previewLimit = WORKSPACE_OVERVIEW_PREVIEW_LIMIT;
export let viewAllLabel = "View all";
</script>

<OverviewSection
  href={workspaceTabHref("todos")}
  title={workspaceCopy.todos.title}
  viewAllHref={workspaceTabHref("todos")}
  viewAllLabel={viewAllLabel}
  viewAllVisible={pendingTodos.length > previewLimit}
>
  {#snippet action()}
    <div class="flex flex-wrap gap-1.5 text-muted-foreground text-xs">
      <span>
        {formatMessage(workspaceCopy.todos.dueToday, {
          count: todosDueToday.length,
        })}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {formatMessage(workspaceCopy.todos.dueSoon, {
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
            <a href={workspaceTabHref("todos")} {...props}>
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
