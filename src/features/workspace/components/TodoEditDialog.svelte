<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  DashboardTodoItem,
  DashboardTodoPriorityOption,
  DashboardTodosCopy,
} from "@/features/workspace/lib/dashboard-controller-helpers";
import { enhance } from "$app/forms";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import TodoFormFields from "./TodoFormFields.svelte";

export let commentsCopy: CommentsCopy;
export let datetimeLocalValue: (
  value: string | Date | null | undefined,
) => string;
export let editTodoError: string;
export let isUpdatingTodo: boolean;
export let onClose: () => void;
export let todo: DashboardTodoItem | null;
export let todoPriorityOptions: DashboardTodoPriorityOption[];
export let todosCopy: DashboardTodosCopy;
export let updateTodoAction: SubmitFunction;
</script>

{#if todo}
  <Dialog.Root
    open={true}
    onOpenChange={(open) => {
      if (!open) onClose();
    }}
  >
    <Dialog.Content
      class="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] min-h-0 max-w-lg flex-col gap-0 overflow-clip p-0 sm:h-[min(64vh,36rem)] sm:max-h-[min(64vh,36rem)] sm:max-w-lg"
    >
      <form
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
        method="POST"
        action="?/updateTodo"
        use:enhance={updateTodoAction}
      >
        <input name="id" type="hidden" value={todo.id} />
        <Dialog.Header class="shrink-0 px-5 pb-2 pt-4">
          <Dialog.Title>{todosCopy.editTitle}</Dialog.Title>
          <Dialog.Description>{todosCopy.editDescription}</Dialog.Description>
        </Dialog.Header>
        <ScrollArea class="h-0 min-h-0 flex-1">
          <Field.Group class="gap-4 px-5 py-4">
            {#if editTodoError}
              <Alert.Root variant="destructive">
                <Alert.Description>{editTodoError}</Alert.Description>
              </Alert.Root>
            {/if}
            <TodoFormFields
              {commentsCopy}
              contentValue={todo.content ?? ""}
              disabled={isUpdatingTodo}
              dueAtValue={datetimeLocalValue(todo.dueAt)}
              idPrefix="edit-todo"
              priorityValue={todo.priority ?? "medium"}
              titleValue={todo.title}
              {todoPriorityOptions}
              {todosCopy}
            />
          </Field.Group>
        </ScrollArea>
        <Dialog.Footer class="mx-0 mb-0 shrink-0">
          <Button
            disabled={isUpdatingTodo}
            type="button"
            variant="outline"
            onclick={onClose}
          >
            {todosCopy.cancel}
          </Button>
          <Button disabled={isUpdatingTodo} type="submit">
            {#if isUpdatingTodo}
              <Spinner data-icon="inline-start" />
            {/if}
            {isUpdatingTodo ? todosCopy.saving : todosCopy.saveChanges}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}
