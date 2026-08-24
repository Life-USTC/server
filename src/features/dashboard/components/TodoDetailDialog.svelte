<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import Trash2 from "@lucide/svelte/icons/trash-2";
import type {
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";

export let deleteTodo: (todo: DashboardTodoItem) => void;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let onClose: () => void;
export let openTodoEditor: (todo: DashboardTodoItem) => void;
export let todo: DashboardTodoItem | null;
export let todoActionLabel: (todo: DashboardTodoItem) => string;
export let todoSavingById: Record<string, boolean>;
export let todosCopy: DashboardTodosCopy;
export let todoStatus: (todo: DashboardTodoItem) => string;
export let toggleTodoCompletion: (todo: DashboardTodoItem) => void;

let deleteConfirmOpen = false;
</script>

{#if todo}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    <Dialog.Content
      class="max-w-lg sm:max-w-lg"
    >
      <Dialog.Header>
        <Dialog.Title>{todo.title}</Dialog.Title>
        <Dialog.Description>
          {todosCopy.priority[todo.priority]} · {fmtDate(todo.dueAt)}
        </Dialog.Description>
      </Dialog.Header>
      <div class="grid gap-4 px-5 py-4">
        {#if todo.content}
          <MarkdownPreview class="text-sm" content={todo.content} />
        {:else}
          <p class="text-muted-foreground text-sm">{todosCopy.contentPlaceholder}</p>
        {/if}
        <div class="flex flex-wrap gap-2">
          <Badge>{todoStatus(todo)}</Badge>
        </div>
        <div class="flex justify-between gap-2">
          <AlertDialog.Root bind:open={deleteConfirmOpen}>
            <AlertDialog.Trigger
              aria-label={todosCopy.deleteAriaLabel}
              class={buttonVariants({ variant: "destructive" })}
              disabled={todoSavingById[todo.id]}
              type="button"
            >
              <Trash2 data-icon="inline-start" />
              {todosCopy.delete}
            </AlertDialog.Trigger>
            <AlertDialog.Content class="max-w-md sm:max-w-md">
              <AlertDialog.Header>
                <AlertDialog.Title>{todosCopy.deleteConfirmTitle}</AlertDialog.Title>
                <AlertDialog.Description>
                  {todosCopy.deleteConfirmDescription}
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Cancel disabled={todoSavingById[todo.id]}>
                  {todosCopy.cancel}
                </AlertDialog.Cancel>
                <AlertDialog.Action
                  disabled={todoSavingById[todo.id]}
                  variant="destructive"
                  onclick={() => deleteTodo(todo)}
                >
                  {#if todoSavingById[todo.id]}
                    <Spinner data-icon="inline-start" />
                  {/if}
                  {todoSavingById[todo.id] ? todosCopy.saving : todosCopy.delete}
                </AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog.Root>
          <div class="flex flex-wrap justify-end gap-2">
            <Button
              disabled={todoSavingById[todo.id]}
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
                <RefreshCw data-icon="inline-start" />
              {:else}
                <CheckCircleIcon data-icon="inline-start" />
              {/if}
              {todoSavingById[todo.id] ? todosCopy.saving : todoActionLabel(todo)}
            </Button>
          </div>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Root>
{/if}
