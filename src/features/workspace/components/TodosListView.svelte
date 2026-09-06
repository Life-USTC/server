<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import Pencil from "@lucide/svelte/icons/pencil";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type {
  WorkspaceTodoItem,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import TableIconButton from "$lib/components/TableIconButton.svelte";
import TableRowActions from "$lib/components/TableRowActions.svelte";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import * as Table from "$lib/components/ui/table/index.js";

type TodoDateFormatter = (value: Date | string | null | undefined) => string;
type TodoAction = (todo: WorkspaceTodoItem) => string;
type TodoCompletionToggle = (todo: WorkspaceTodoItem) => void | Promise<void>;

export let filteredTodos: WorkspaceTodoItem[];
export let fmtDate: TodoDateFormatter;
export let openTodoEditor: (todo: WorkspaceTodoItem) => void;
export let selectedTodo: WorkspaceTodoItem | null = null;
export let todoActionLabel: TodoAction;
export let todoSavingById: Record<string, boolean>;
export let todosCopy: WorkspaceTodosCopy;
export let toggleTodoCompletion: TodoCompletionToggle;
</script>

<Table.Root class="min-w-0 w-full">
  <Table.Header>
    <Table.Row>
      <Table.Head>{todosCopy.titleLabel}</Table.Head>
      <Table.Head>{todosCopy.priorityLabel}</Table.Head>
      <Table.Head>{todosCopy.dueAtLabel}</Table.Head>
      <Table.Head>
        <span class="sr-only">{todosCopy.editAriaLabel}</span>
      </Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each filteredTodos as todo}
      <Table.Row class="group">
        <Table.Cell>
          <button
            class="block min-h-11 min-w-0 max-w-full text-left hover:underline"
            class:line-through={todo.completed}
            type="button"
            onclick={() => {
              selectedTodo = todo;
            }}
          >
            <TruncatedText text={todo.title} lines={2} />
          </button>
        </Table.Cell>
        <Table.Cell>
          <Badge
            variant={todo.priority === "high"
              ? "destructive"
              : todo.priority === "medium"
                ? "secondary"
                : "outline"}
          >
            {todosCopy.priority[todo.priority]}
          </Badge>
        </Table.Cell>
        <Table.Cell>
          {fmtDate(todo.dueAt)}
        </Table.Cell>
        <Table.Cell>
          <TableRowActions>
            <TableIconButton
              disabled={todoSavingById[todo.id]}
              label={todoSavingById[todo.id]
                ? todosCopy.saving
                : todoActionLabel(todo)}
              variant={todo.completed ? "secondary" : "default"}
              onclick={() => void toggleTodoCompletion(todo)}
            >
              {#if todoSavingById[todo.id]}
                <Spinner data-icon="inline-start" />
              {:else if todo.completed}
                <RefreshCw data-icon="inline-start" />
              {:else}
                <CheckCircleIcon data-icon="inline-start" />
              {/if}
            </TableIconButton>
            <TableIconButton
              label={todosCopy.editTitle}
              variant="outline"
              onclick={() => openTodoEditor(todo)}
            >
              <Pencil data-icon="inline-start" />
            </TableIconButton>
          </TableRowActions>
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
