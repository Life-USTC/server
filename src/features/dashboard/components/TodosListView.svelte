<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import LoaderCircle from "@lucide/svelte/icons/loader-circle";
import Pencil from "@lucide/svelte/icons/pencil";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import type {
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
import TruncatedText from "$lib/components/TruncatedText.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import DashboardTableIconButton from "./DashboardTableIconButton.svelte";
import DashboardTableRowActions from "./DashboardTableRowActions.svelte";

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
      <Table.Row
        class="group cursor-pointer"
        onclick={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest("button, a")) return;
          selectedTodo = todo;
        }}
      >
        <Table.Cell>
          <button
            class="block min-w-0 max-w-full overflow-hidden text-left hover:underline"
            class:line-through={todo.completed}
            type="button"
            onclick={() => {
              selectedTodo = todo;
            }}
          >
            <TruncatedText text={todo.title} />
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
          <DashboardTableRowActions>
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
          </DashboardTableRowActions>
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
