<script lang="ts">
import type {
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import CheckCircleIcon from "$lib/components/icons/check-circle.svelte";
import RefreshCw from "$lib/components/icons/refresh-cw.svelte";
import Trash2 from "$lib/components/icons/trash-2.svelte";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";

export let deleteTodo: (todo: DashboardTodoItem) => void;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let onClose: () => void;
export let openTodoEditor: (todo: DashboardTodoItem) => void;
export let todo: DashboardTodoItem | null;
export let todoActionLabel: (todo: DashboardTodoItem) => string;
export let todoPriorityClass: (priority: string) => string;
export let todoSavingById: Record<string, boolean>;
export let todosCopy: DashboardTodosCopy;
export let todoStatus: (todo: DashboardTodoItem) => string;
export let toggleTodoCompletion: (todo: DashboardTodoItem) => void;
</script>

{#if todo}
  <Dialog.Root
    open={true}
    class="max-w-lg"
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    <Dialog.Header>
      <Dialog.Title>{todo.title}</Dialog.Title>
      <Dialog.Description>
        {todo.priority} · {fmtDate(todo.dueAt)}
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 px-5 py-4">
      {#if todo.content}
        <MarkdownPreview class="text-sm" content={todo.content} />
      {:else}
        <p class="text-base-content/60 text-sm">{todosCopy.contentPlaceholder}</p>
      {/if}
      <div class="flex flex-wrap gap-2">
        <Badge class={todoPriorityClass(todo.priority)}>
          {todosCopy.priority[todo.priority]}
        </Badge>
        <Badge>{todoStatus(todo)}</Badge>
      </div>
      <div class="flex justify-between gap-2">
        <Button
          aria-label={todosCopy.deleteAriaLabel}
          class="border-error bg-error text-error-content hover:bg-error/90"
          disabled={todoSavingById[todo.id]}
          type="button"
          onclick={() => {
            deleteTodo(todo);
          }}
        >
          <Trash2 />
          {todoSavingById[todo.id] ? todosCopy.saving : todosCopy.delete}
        </Button>
        <div class="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onclick={() => {
              openTodoEditor(todo);
            }}
          >
            {todosCopy.editTitle}
          </Button>
          <Button
            disabled={todoSavingById[todo.id]}
            type="button"
            variant="outline"
            onclick={() => {
              toggleTodoCompletion(todo);
            }}
          >
            {#if todo.completed}
              <RefreshCw />
            {:else}
              <CheckCircleIcon />
            {/if}
            {todoSavingById[todo.id] ? todosCopy.saving : todoActionLabel(todo)}
          </Button>
        </div>
      </div>
    </div>
  </Dialog.Root>
{/if}
