<script lang="ts">
import Pencil from "@lucide/svelte/icons/pencil";
import Trash2 from "@lucide/svelte/icons/trash-2";
import MarkdownPreview from "#lib/components/MarkdownPreview.svelte";
import TaskCompletionButton from "#lib/components/TaskCompletionButton.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button, buttonVariants } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import { ScrollArea } from "#lib/components/ui/scroll-area/index.js";
import Table from "#lib/components/ui/table/table.svelte";
import { cn } from "#lib/utils.js";
import type {
  WorkspaceTodoItem,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import type { TodoDisplay } from "../lib/todos-tab-display";

export let display: TodoDisplay;
export let deleteTodo: (todo: WorkspaceTodoItem) => void | Promise<void>;
export let onClose: () => void;
export let openTodoEditor: (todo: WorkspaceTodoItem) => void;
export let todo: WorkspaceTodoItem | null;
export let todoSavingById: Record<string, boolean>;
export let todosCopy: WorkspaceTodosCopy;
export let toggleTodoCompletion: (todo: WorkspaceTodoItem) => void;
export let readOnlyReason: string | undefined = undefined;

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
  if (readOnlyReason || !todo || deletePending || todoSavingById[todo.id])
    return;
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
          {todosCopy.priority[todo.priority]} · {display.fmtDate(todo.dueAt)}
        </Dialog.Description>
      </Dialog.Header>
      <ScrollArea class="h-0 min-h-0 flex-1">
        <div class="grid min-w-0 gap-4 px-5 py-4">
          {#if readOnlyReason}
            <Alert.Root>
              <Alert.Description>{readOnlyReason}</Alert.Description>
            </Alert.Root>
          {/if}
          <div class="min-w-0" data-testid="todo-detail-summary">
            <p class="text-muted-foreground text-sm">{todosCopy.dueAtLabel}</p>
            <p class="mt-1 text-xl font-semibold tracking-tight">
              {display.fmtDate(todo.dueAt)}
            </p>
            {#if todo.dueAt}
              <p
                class={cn(
                  "mt-1 text-sm",
                  display.isDueOverdue(todo.dueAt)
                    ? "text-destructive font-medium"
                    : "text-muted-foreground",
                )}
              >
                {display.relativeDueLabel(todo.dueAt)}
              </p>
            {/if}
            <Table class="mt-4">
              <tbody>
                <tr>
                  <th
                    class="text-muted-foreground h-auto w-[38%] px-0 py-2"
                    scope="row"
                  >
                    {todosCopy.priorityLabel}
                  </th>
                  <td class="h-auto px-0 py-2">
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
                  </td>
                </tr>
                <tr>
                  <th
                    class="text-muted-foreground h-auto px-0 py-2"
                    scope="row"
                  >
                    {todosCopy.statusLabel}
                  </th>
                  <td class="h-auto px-0 py-2">
                    {display.todoStatus(todo)}
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>
          {#if todo.content}
            <MarkdownPreview class="min-w-0 break-words text-sm" content={todo.content} />
          {:else}
            <p class="text-muted-foreground text-sm">{todosCopy.contentEmpty}</p>
          {/if}
        </div>
      </ScrollArea>
      <div data-slot="dialog-footer" class="mx-0 mb-0 shrink-0 p-4">
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
              disabled={Boolean(readOnlyReason) || todoSavingById[todo.id] || deletePending}
              type="button"
            >
              <Trash2 data-icon="inline-start" />
              {todosCopy.delete}
            </AlertDialog.Trigger>
            <AlertDialog.Content class="max-w-md sm:max-w-md">
              <AlertDialog.Heading
                title={todosCopy.deleteConfirmTitle}
                description={deleteDescription(todo)}
              />
              <AlertDialog.Actions
                cancelLabel={todosCopy.cancel}
                confirmLabel={deletePending || todoSavingById[todo.id] ? todosCopy.saving : todosCopy.delete}
                pending={deletePending || todoSavingById[todo.id]}
                onclick={confirmDelete}
              />
            </AlertDialog.Content>
          </AlertDialog.Root>
          <TaskCompletionButton
            class="w-full sm:w-auto"
            {readOnlyReason}
            completed={todo.completed}
            saving={todoSavingById[todo.id]}
            savingLabel={todosCopy.saving}
            label={display.todoActionLabel(todo)}
            onclick={() => void toggleTodoCompletion(todo)}
          />
          <Button
            class="w-full sm:ml-auto sm:w-auto"
            disabled={Boolean(readOnlyReason) || todoSavingById[todo.id]}
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
      </div>
    </Dialog.Content>
  </Dialog.Root>
{/if}
