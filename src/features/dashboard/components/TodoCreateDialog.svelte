<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  DashboardTodoPriorityOption,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { enhance } from "$app/forms";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Dialog from "$lib/components/ui/dialog/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Spinner } from "$lib/components/ui/spinner/index.js";
import TodoFormFields from "./TodoFormFields.svelte";

export let commentsCopy: CommentsCopy;
export let createTodoAction: SubmitFunction;
export let createTodoError: string;
export let isCreatingTodo: boolean;
export let onClose: () => void;
export let open: boolean;
export let todoPriorityOptions: DashboardTodoPriorityOption[];
export let todosCopy: DashboardTodosCopy;
</script>

{#if open}
  <Dialog.Root
    open={true}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}
  >
    <Dialog.Content
      class="max-w-lg sm:max-w-lg"
    >
      <form method="POST" action="?/createTodo" use:enhance={createTodoAction}>
        <Dialog.Header>
          <Dialog.Title>{todosCopy.createTitle}</Dialog.Title>
          <Dialog.Description>{todosCopy.subtitle}</Dialog.Description>
        </Dialog.Header>
        <Field.Group class="gap-4 px-5 py-4">
          {#if createTodoError}
            <Alert.Root variant="destructive">
              <Alert.Description>{createTodoError}</Alert.Description>
            </Alert.Root>
          {/if}
          <TodoFormFields
            {commentsCopy}
            disabled={isCreatingTodo}
            idPrefix="create-todo"
            {todoPriorityOptions}
            {todosCopy}
          />
        </Field.Group>
        <Dialog.Footer>
          <Button
            disabled={isCreatingTodo}
            type="button"
            variant="outline"
            onclick={onClose}
          >
            {todosCopy.cancel}
          </Button>
          <Button disabled={isCreatingTodo} type="submit">
            {#if isCreatingTodo}
              <Spinner data-icon="inline-start" />
            {/if}
            {isCreatingTodo ? todosCopy.saving : todosCopy.createAction}
          </Button>
        </Dialog.Footer>
      </form>
    </Dialog.Content>
  </Dialog.Root>
{/if}
