<script lang="ts">
import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
import Pencil from "@lucide/svelte/icons/pencil";
import MobileListCard from "#lib/components/MobileListCard.svelte";
import ResponsiveCollection from "#lib/components/ResponsiveCollection.svelte";
import TableIconButton from "#lib/components/TableIconButton.svelte";
import TableRowActions from "#lib/components/TableRowActions.svelte";
import TaskCompletionButton from "#lib/components/TaskCompletionButton.svelte";
import TruncatedText from "#lib/components/TruncatedText.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as DropdownMenu from "#lib/components/ui/dropdown-menu/index.js";
import * as Item from "#lib/components/ui/item/index.js";
import * as Table from "#lib/components/ui/table/index.js";
import type {
  WorkspaceTodoItem,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import type { TodoDisplay } from "../lib/todos-tab-display";
import WorkspaceTaskEmptyState from "./WorkspaceTaskEmptyState.svelte";

type TodoCompletionToggle = (todo: WorkspaceTodoItem) => void | Promise<void>;

export let display: TodoDisplay;
export let hasTodoItems: boolean;
export let emptyTitle: string;
export let onClearFilter: () => void;
export let filteredTodos: WorkspaceTodoItem[];
export let openTodoEditor: (todo: WorkspaceTodoItem) => void;
export let onSelect: (
  todo: WorkspaceTodoItem,
  trigger: HTMLButtonElement,
) => void;
export let todoSavingById: Record<string, boolean>;
export let todosCopy: WorkspaceTodosCopy;
export let toggleTodoCompletion: TodoCompletionToggle;
export let readOnlyReason: string | undefined = undefined;
</script>

{#snippet completion(todo: WorkspaceTodoItem)}
  <TaskCompletionButton
    iconOnly
    {readOnlyReason}
    completed={todo.completed}
    saving={todoSavingById[todo.id]}
    savingLabel={todosCopy.saving}
    label={display.todoActionLabel(todo)}
    onclick={() => void toggleTodoCompletion(todo)}
  />
{/snippet}

{#snippet priority(todo: WorkspaceTodoItem)}
  <Badge
    variant={todo.priority === "high"
      ? "destructive"
      : todo.priority === "medium"
        ? "secondary"
        : "outline"}
  >
    {todosCopy.priority[todo.priority]}
  </Badge>
{/snippet}

{#snippet emptyState()}
  <WorkspaceTaskEmptyState
    title={hasTodoItems ? todosCopy.filterEmptyTitle : emptyTitle}
    description={hasTodoItems ? todosCopy.filterEmptyDescription : undefined}
    clearFilterLabel={todosCopy.clearFilter}
    onClearFilter={hasTodoItems ? onClearFilter : undefined}
  />
{/snippet}

<ResponsiveCollection workspace>
  {#snippet mobile()}
    <div class="min-w-0" data-testid="workspace-todos-cards">
      {#if filteredTodos.length > 0}
        <Item.Group class="gap-0">
          {#each filteredTodos as todo, index (todo.id)}
            <MobileListCard>
              <Item.Content class="min-w-0 gap-1">
                <Item.Title class="line-clamp-none w-full min-w-0">
                  <button
                    class="flex min-h-11 w-full min-w-0 max-w-full items-center text-left underline-offset-4 hover:underline"
                    type="button"
                    onclick={(event) => onSelect(todo, event.currentTarget)}
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
                  <span class="max-w-full break-words">{display.fmtDate(todo.dueAt)}</span>
                  <span aria-hidden="true">·</span>
                  {@render priority(todo)}
                  <Badge variant="ghost">{display.todoStatus(todo)}</Badge>
                </Item.Description>
              </Item.Content>
              <Item.Actions class="shrink-0 self-start">
                {@render completion(todo)}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    {#snippet render({ props })}
                      <Button
                        {...props}
                        aria-label={todosCopy.editAriaLabel}
                        disabled={Boolean(readOnlyReason)}
                        title={readOnlyReason}
                        class="icon-action" size="icon"
                        type="button"
                        variant="outline"
                      >
                        <MoreHorizontal data-icon="inline-start" />
                      </Button>
                    {/snippet}
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Group>
                      <DropdownMenu.Item disabled={Boolean(readOnlyReason)} onSelect={() => openTodoEditor(todo)}>
                        <Pencil />
                        {todosCopy.editTitle}
                      </DropdownMenu.Item>
                    </DropdownMenu.Group>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Item.Actions>
            </MobileListCard>
            {#if index < filteredTodos.length - 1}
              <Item.Separator class="my-0" />
            {/if}
          {/each}
        </Item.Group>
      {:else}
        {@render emptyState()}
      {/if}
    </div>
  {/snippet}
  {#snippet desktop()}
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
        {#each filteredTodos as todo (todo.id)}
          <Table.Row class="group">
            <Table.Cell>
              <button
                class="block min-h-11 min-w-0 max-w-full text-left font-medium hover:underline"
                class:line-through={todo.completed}
                type="button"
                onclick={(event) => onSelect(todo, event.currentTarget)}
              >
                <TruncatedText text={todo.title} lines={2} />
              </button>
            </Table.Cell>
            <Table.Cell>
              {@render priority(todo)}
            </Table.Cell>
            <Table.Cell>
              {display.fmtDate(todo.dueAt)}
            </Table.Cell>
            <Table.Cell>
              <TableRowActions>
                {@render completion(todo)}
                <TableIconButton
                  label={todosCopy.editTitle}
                  disabled={Boolean(readOnlyReason)}
                  variant="outline"
                  onclick={() => openTodoEditor(todo)}
                >
                  <Pencil data-icon="inline-start" />
                </TableIconButton>
              </TableRowActions>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row class="hover:bg-transparent">
            <Table.Cell class="p-0" colspan={4}>
              {@render emptyState()}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  {/snippet}
</ResponsiveCollection>
