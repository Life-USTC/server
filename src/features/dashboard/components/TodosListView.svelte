<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type {
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";

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
export let toggleTodoCompletion: TodoCompletionToggle;
</script>

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head>{todosCopy.titleLabel}</Table.Head>
      <Table.Head class="text-center">{todosCopy.priorityLabel}</Table.Head>
      <Table.Head class="text-center">{todosCopy.dueAtLabel}</Table.Head>
      <Table.Head class="text-right">
        <span class="sr-only">{todosCopy.editAriaLabel}</span>
      </Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each filteredTodos as todo}
      <Table.Row>
        <Table.Cell class="max-w-0">
          <button
            class:line-through={todo.completed}
            class="block max-w-full truncate text-left font-medium hover:underline"
            type="button"
            onclick={() => {
              selectedTodo = todo;
            }}
          >
            {todo.title}
          </button>
        </Table.Cell>
        <Table.Cell class="text-center">
          <Badge class={todoPriorityClass(todo.priority)}>
            {todosCopy.priority[todo.priority]}
          </Badge>
        </Table.Cell>
        <Table.Cell class="text-center text-base-content/70">
          {fmtDate(todo.dueAt)}
        </Table.Cell>
        <Table.Cell>
          <div class="flex justify-end gap-2">
            <Button
              class="h-8"
              size="sm"
              type="button"
              variant="outline"
              onclick={() => openTodoEditor(todo)}
            >
              {todosCopy.editTitle}
            </Button>
            <Button
              class="h-8"
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
          </div>
        </Table.Cell>
      </Table.Row>
    {:else}
      <Table.Row>
        <Table.Cell class="p-0" colspan={4}>
          <Empty.Root class="py-8">
            <Empty.Header>
              <Empty.Title>{todosCopy.filterEmptyTitle}</Empty.Title>
              <Empty.Description>
                {todosCopy.filterEmptyDescription}
              </Empty.Description>
            </Empty.Header>
          </Empty.Root>
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
