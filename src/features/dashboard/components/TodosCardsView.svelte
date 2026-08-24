<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import LoaderCircle from "@lucide/svelte/icons/loader-circle";
import Pencil from "@lucide/svelte/icons/pencil";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type {
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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
        <Item.Root class="items-start px-2 py-2" size="sm">
          <Item.Content class="min-w-0 gap-0.5">
            <Item.Title class="block min-w-0 max-w-full">
              <button
                class:line-through={todo.completed}
                class="block min-w-0 max-w-full truncate text-left underline-offset-4 hover:underline"
                type="button"
                onclick={() => {
                  selectedTodo = todo;
                }}
              >
                {todo.title}
              </button>
            </Item.Title>
            <Item.Description class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span class="truncate">{fmtDate(todo.dueAt)}</span>
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
              label={todosCopy.editTitle}
              onclick={() => openTodoEditor(todo)}
            >
              <Pencil />
            </DashboardTableIconButton>
            <DashboardTableIconButton
              disabled={todoSavingById[todo.id]}
              label={todoSavingById[todo.id]
                ? todosCopy.saving
                : todoActionLabel(todo)}
              onclick={() => void toggleTodoCompletion(todo)}
            >
              {#if todoSavingById[todo.id]}
                <LoaderCircle class="animate-spin" />
              {:else if todo.completed}
                <RefreshCw />
              {:else}
                <CheckCircleIcon />
              {/if}
            </DashboardTableIconButton>
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
