<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type {
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
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
export let todoSavingById: Record<string, boolean>;
export let todosCopy: DashboardTodosCopy;
export let todoStatus: TodoAction;
export let toggleTodoCompletion: TodoCompletionToggle;
</script>

<div class="grid gap-3 md:grid-cols-2" data-testid="dashboard-todos-cards">
  {#each filteredTodos as todo}
    <Card.Root
      class="group"
      data-slot="card"
    >
      <Card.Header>
        <Card.Title>
          <button
            class:line-through={todo.completed}
            class="text-left underline-offset-4 hover:underline"
            type="button"
            onclick={() => {
              selectedTodo = todo;
            }}
          >
            {todo.title}
          </button>
        </Card.Title>
        <Card.Action>
          <Badge variant="outline">
            {todoStatus(todo)}
          </Badge>
        </Card.Action>
      </Card.Header>
      <Card.Content class="grid gap-3">
        <div class="flex flex-wrap gap-2">
          <Badge
            variant={todo.priority === "high"
              ? "destructive"
              : todo.priority === "medium"
                ? "secondary"
                : "outline"}
          >
            {todosCopy.priority[todo.priority]}
          </Badge>
          <Badge variant="ghost">{fmtDate(todo.dueAt)}</Badge>
        </div>
        {#if todo.content}
          <MarkdownPreview class="line-clamp-3 text-sm" content={todo.content} />
        {/if}
      </Card.Content>
      <Card.Footer class="justify-end gap-2">
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
            <RefreshCw data-icon="inline-start" />
          {:else}
            <CheckCircleIcon data-icon="inline-start" />
          {/if}
          {todoSavingById[todo.id] ? todosCopy.saving : todoActionLabel(todo)}
        </Button>
      </Card.Footer>
    </Card.Root>
  {:else}
    <TodoEmptyState {todosCopy} />
  {/each}
</div>
