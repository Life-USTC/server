<script lang="ts">
import type {
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
import CheckCircleIcon from "$lib/components/icons/check-circle.svelte";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Card from "$lib/components/ui/card/index.js";
import TodoEmptyState from "./TodoEmptyState.svelte";

type TodoDateFormatter = (value: Date | string | null | undefined) => string;
type TodoAction = (todo: DashboardTodoItem) => string;
type TodoCompletionToggle = (todo: DashboardTodoItem) => void | Promise<void>;

export let filteredTodos: DashboardTodoItem[];
export let fmtDate: TodoDateFormatter;
export let openTodoEditor: (todo: DashboardTodoItem) => void;
export let selectedTodo: DashboardTodoItem | null;
export let todoActionLabel: TodoAction;
export let todoPriorityClass: (
  priority: DashboardTodoItem["priority"],
) => string;
export let todoSavingById: Record<string, boolean>;
export let todosCopy: DashboardTodosCopy;
export let todoStatus: TodoAction;
export let toggleTodoCompletion: TodoCompletionToggle;
</script>

<div class="grid gap-3 md:grid-cols-2">
  {#each filteredTodos as todo}
    <Card.Root
      class="group transition hover:border-primary"
      data-slot="card"
    >
      <Card.Content class="grid gap-3 pt-5">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <button
            class:line-through={todo.completed}
            class="text-left font-semibold text-lg hover:underline"
            type="button"
            onclick={() => {
              selectedTodo = todo;
            }}
          >
            {todo.title}
          </button>
          <Badge variant="outline">
            {todoStatus(todo)}
          </Badge>
        </div>
        <div class="flex flex-wrap gap-2">
          <Badge class={todoPriorityClass(todo.priority)}>
            {todosCopy.priority[todo.priority]}
          </Badge>
          <Badge variant="ghost">{fmtDate(todo.dueAt)}</Badge>
        </div>
        {#if todo.content}
          <MarkdownPreview class="line-clamp-3 text-sm" content={todo.content} />
        {/if}
        <div class="flex justify-end gap-2">
          <Button
            size="sm"
            type="button"
            variant="outline"
            onclick={() => openTodoEditor(todo)}
          >
            {todosCopy.editTitle}
          </Button>
          <Button
            disabled={todoSavingById[todo.id]}
            size="sm"
            type="button"
            variant="outline"
            onclick={() => void toggleTodoCompletion(todo)}
          >
            {#if todo.completed}
              <RefreshCw />
            {:else}
              <CheckCircleIcon />
            {/if}
            {todoSavingById[todo.id] ? todosCopy.saving : todoActionLabel(todo)}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  {:else}
    <TodoEmptyState {todosCopy} />
  {/each}
</div>
