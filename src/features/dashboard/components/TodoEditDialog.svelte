<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  DashboardTodoItem,
  DashboardTodoPriorityOption,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { enhance } from "$app/forms";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
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
      class="max-w-lg"
    >
      <form method="POST" action="?/updateTodo" use:enhance={updateTodoAction}>
        <input name="id" type="hidden" value={todo.id} />
        <Dialog.Header>
          <Dialog.Title>{todosCopy.editTitle}</Dialog.Title>
          <Dialog.Description>{todosCopy.contentPlaceholder}</Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-4 px-5 py-4">
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
            priorityValue={todo.priority ?? "medium"}
            titleValue={todo.title}
            {todoPriorityOptions}
            {todosCopy}
          />
        </div>
        <Dialog.Footer>
          <Button type="button" variant="outline" onclick={onClose}>
            {todosCopy.cancel}
          </Button>
          <Button disabled={isUpdatingTodo} type="submit">
            {isUpdatingTodo ? todosCopy.saving : todosCopy.saveChanges}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}
