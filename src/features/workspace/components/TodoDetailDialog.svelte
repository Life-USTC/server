<script lang="ts">
import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
import Pencil from "@lucide/svelte/icons/pencil";
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
import { Spinner } from "$lib/components/ui/spinner/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import { cn } from "$lib/utils.js";

export let deleteTodo: (todo: WorkspaceTodoItem) => void | Promise<void>;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let isDueOverdue: (value: string | Date | null | undefined) => boolean;
export let onClose: () => void;
export let openTodoEditor: (todo: WorkspaceTodoItem) => void;
export let relativeDueLabel: (
  value: string | Date | null | undefined,
) => string;
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
      <Dialog.Header class="shrink-0 px-5 pb-2 pt-4 pr-12">
        <Dialog.Title class={cn("break-words", todo.completed && "line-through")}
          >{todo.title}</Dialog.Title
        >
        <Dialog.Description class="sr-only">
          {todosCopy.priority[todo.priority]} · {fmtDate(todo.dueAt)}
        </Dialog.Description>
      </Dialog.Header>
      <ScrollArea class="h-0 min-h-0 flex-1">
        <div class="grid min-w-0 gap-4 px-5 py-4">
          <div class="min-w-0" data-testid="todo-detail-summary">
            <p class="text-muted-foreground text-sm">{todosCopy.dueAtLabel}</p>
            <p class="mt-1 text-xl font-semibold tracking-tight">
              {fmtDate(todo.dueAt)}
            </p>
            {#if todo.dueAt}
              <p
                class={cn(
                  "mt-1 text-sm",
                  isDueOverdue(todo.dueAt)
                    ? "text-destructive font-medium"
                    : "text-muted-foreground",
                )}
              >
                {relativeDueLabel(todo.dueAt)}
              </p>
            {/if}
            <Table.Root class="mt-4">
              <Table.Body>
                <Table.Row>
                  <Table.Head
                    class="text-muted-foreground h-auto w-[38%] px-0 py-2"
                    scope="row"
                  >
                    {todosCopy.priorityLabel}
                  </Table.Head>
                  <Table.Cell class="h-auto px-0 py-2">
                    <!-- Keep #1027's severity encoding; it just lives in the
                         facts table now instead of the dialog description. -->
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
                </Table.Row>
                <Table.Row>
                  <Table.Head
                    class="text-muted-foreground h-auto px-0 py-2"
                    scope="row"
                  >
                    {todosCopy.statusLabel}
                  </Table.Head>
                  <Table.Cell class="h-auto px-0 py-2">
                    {todoStatus(todo)}
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </div>
          {#if todo.content}
            <MarkdownPreview class="min-w-0 break-words text-sm" content={todo.content} />
          {:else}
            <p class="text-muted-foreground text-sm">{todosCopy.contentEmpty}</p>
          {/if}
        </div>
      </ScrollArea>
      <Dialog.Footer class="mx-0 mb-0 shrink-0 p-4">
        <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
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
            class="w-full sm:ml-auto sm:w-auto"
            disabled={todoSavingById[todo.id]}
            type="button"
            variant="outline"
            onclick={() => {
              openTodoEditor(todo);
            }}
          >
            <Pencil data-icon="inline-start" />
            {todosCopy.editTitle}
          </Button>
        </div>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
