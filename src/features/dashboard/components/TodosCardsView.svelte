<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
import Pencil from "@lucide/svelte/icons/pencil";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type {
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import DashboardTableIconButton from "./DashboardTableIconButton.svelte";
import TodoEmptyState from "./TodoEmptyState.svelte";

type TodoDateFormatter = (value: Date | string | null | undefined) => string;
type TodoAction = (todo: DashboardTodoItem) => string;
type TodoCompletionToggle = (todo: DashboardTodoItem) => void | Promise<void>;

export let filteredTodos: DashboardTodoItem[];
export let fmtDate: TodoDateFormatter;
export let openTodoEditor: (todo: DashboardTodoItem) => void;
export let selectedTodo: DashboardTodoItem | null = null;
export let todoActionLabel: TodoAction;
export let todoSavingById: Record<string, boolean>;
export let todosCopy: DashboardTodosCopy;
export let todoStatus: TodoAction;
export let toggleTodoCompletion: TodoCompletionToggle;
</script>

<div class="min-w-0" data-testid="dashboard-todos-cards">
  {#if filteredTodos.length > 0}
    <Item.Group class="gap-0">
      {#each filteredTodos as todo, index (todo.id)}
        <Item.Root class="items-start gap-3 px-2 py-3">
          <Item.Content class="min-w-0 gap-1">
            <Item.Title class="line-clamp-none w-full min-w-0">
              <button
                class="flex min-h-11 w-full min-w-0 max-w-full items-center text-left underline-offset-4 hover:underline"
                type="button"
                onclick={() => {
                  selectedTodo = todo;
                }}
              >
                <span
                  class:line-through={todo.completed}
                  class="line-clamp-2 min-w-0 max-w-full break-words"
                >{todo.title}</span>
              </button>
            </Item.Title>
            <Item.Description
              class="line-clamp-none flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 break-words"
            >
              <span class="max-w-full break-words">{fmtDate(todo.dueAt)}</span>
              <span aria-hidden="true">·</span>
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
          <Item.Actions class="shrink-0 self-start">
            <DashboardTableIconButton
              className="size-11"
              disabled={todoSavingById[todo.id]}
              label={todoSavingById[todo.id]
                ? todosCopy.saving
                : todoActionLabel(todo)}
              variant={todo.completed ? "secondary" : "default"}
              onclick={() => void toggleTodoCompletion(todo)}
            >
              {#if todoSavingById[todo.id]}
                <Spinner />
              {:else if todo.completed}
                <RefreshCw />
              {:else}
                <CheckCircleIcon />
              {/if}
            </DashboardTableIconButton>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    aria-label={todosCopy.editAriaLabel}
                    class="size-11"
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <MoreHorizontal />
                  </Button>
                {/snippet}
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                <DropdownMenu.Group>
                  <DropdownMenu.Item onSelect={() => openTodoEditor(todo)}>
                    <Pencil />
                    {todosCopy.editTitle}
                  </DropdownMenu.Item>
                </DropdownMenu.Group>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Item.Actions>
        </Item.Root>
        {#if index < filteredTodos.length - 1}
          <Item.Separator class="my-0" />
        {/if}
      {/each}
    </Item.Group>
  {:else}
    <TodoEmptyState {todosCopy} />
  {/if}
</div>
