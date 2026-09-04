<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import RefreshCw from "@lucide/svelte/icons/refresh-cw";
import Trash2 from "@lucide/svelte/icons/trash-2";
import type {
  WorkspaceTodoItem,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import MarkdownPreview from "$lib/components/MarkdownPreview.svelte";
import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { Separator } from "$lib/components/ui/separator/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import { cn } from "$lib/utils.js";

export let deleteTodo: (todo: WorkspaceTodoItem) => void | Promise<void>;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let onClose: () => void;
export let openTodoEditor: (todo: WorkspaceTodoItem) => void;
export let todo: WorkspaceTodoItem | null;
export let todoActionLabel: (todo: WorkspaceTodoItem) => string;
export let todoSavingById: Record<string, boolean>;
export let todosCopy: WorkspaceTodosCopy;
export let todoStatus: (todo: WorkspaceTodoItem) => string;
export let toggleTodoCompletion: (todo: WorkspaceTodoItem) => void;

let deleteConfirmOpen = false;
let deletePending = false;

function deleteDescription(todo: WorkspaceTodoItem) {
  return todosCopy.deleteConfirmDescription.replace(
    "{title}",
    () => todo.title,
  );
}

async function confirmDelete(event: MouseEvent) {
  event.preventDefault();
  if (!todo || deletePending || todoSavingById[todo.id]) return;
  deletePending = true;
  try {
    await deleteTodo(todo);
  } finally {
    deletePending = false;
  }
}
</script>

{#if todo}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) {
        deletePending = false;
        onClose();
      }
    }}
  >
    <Dialog.Content
      class="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] min-h-0 max-w-lg flex-col gap-0 overflow-clip p-0 sm:h-[min(64vh,36rem)] sm:max-h-[min(64vh,36rem)] sm:max-w-lg"
    >
      <Dialog.Header class="shrink-0 px-5 pb-2 pt-4">
        <Dialog.Title class="break-words">{todo.title}</Dialog.Title>
        <Dialog.Description>
          {todosCopy.priority[todo.priority]} · {fmtDate(todo.dueAt)}
        </Dialog.Description>
      </Dialog.Header>
      <ScrollArea class="h-0 min-h-0 flex-1">
        <div class="grid min-w-0 gap-4 px-5 py-4">
          {#if todo.content}
            <MarkdownPreview class="min-w-0 break-words text-sm" content={todo.content} />
          {:else}
            <p class="text-muted-foreground text-sm">{todosCopy.contentEmpty}</p>
          {/if}
          <div class="flex flex-wrap gap-2">
            <Badge>{todoStatus(todo)}</Badge>
          </div>
        </div>
      </ScrollArea>
      <Dialog.Footer class="mx-0 mb-0 shrink-0 p-4">
        <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              class="w-full sm:w-auto"
              disabled={todoSavingById[todo.id]}
              type="button"
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
            <Button
              class="w-full sm:w-auto"
              disabled={todoSavingById[todo.id]}
              type="button"
              variant="outline"
              onclick={() => {
                openTodoEditor(todo);
              }}
            >
              {todosCopy.editTitle}
            </Button>
          </div>
          <Separator class="sm:hidden" />
          <Separator class="hidden sm:block" orientation="vertical" />
          <div class="sm:ml-auto">
            <AlertDialog.Root
              open={deleteConfirmOpen}
              onOpenChange={(open) => {
                deleteConfirmOpen = open;
                if (!open) deletePending = false;
              }}
            >
              <AlertDialog.Trigger
                aria-label={todosCopy.deleteAriaLabel}
                class={cn(buttonVariants({ variant: "destructive" }), "w-full sm:w-auto")}
                disabled={todoSavingById[todo.id] || deletePending}
                type="button"
              >
                <Trash2 data-icon="inline-start" />
                {todosCopy.delete}
              </AlertDialog.Trigger>
              <AlertDialog.Content class="max-w-md sm:max-w-md">
                <AlertDialog.Header>
                  <AlertDialog.Title>{todosCopy.deleteConfirmTitle}</AlertDialog.Title>
                  <AlertDialog.Description>{deleteDescription(todo)}</AlertDialog.Description>
                </AlertDialog.Header>
                <AlertDialog.Footer>
                  <AlertDialog.Cancel disabled={deletePending || todoSavingById[todo.id]}>
                    {todosCopy.cancel}
                  </AlertDialog.Cancel>
                  <AlertDialog.Action
                    disabled={deletePending || todoSavingById[todo.id]}
                    variant="destructive"
                    onclick={confirmDelete}
                  >
                    {#if deletePending || todoSavingById[todo.id]}
                      <Spinner data-icon="inline-start" />
                    {/if}
                    {deletePending || todoSavingById[todo.id]
                      ? todosCopy.saving
                      : todosCopy.delete}
                  </AlertDialog.Action>
                </AlertDialog.Footer>
              </AlertDialog.Content>
            </AlertDialog.Root>
          </div>
        </div>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
