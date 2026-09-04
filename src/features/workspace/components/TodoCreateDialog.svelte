<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
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
      class="flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] min-h-0 max-w-lg flex-col gap-0 overflow-clip p-0 sm:h-[min(64vh,36rem)] sm:max-h-[min(64vh,36rem)] sm:max-w-lg"
    >
      <form
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
        method="POST"
        action="?/createTodo"
        use:enhance={createTodoAction}
      >
        <Dialog.Header class="shrink-0 px-5 pb-2 pt-4">
          <Dialog.Title>{todosCopy.createTitle}</Dialog.Title>
          <Dialog.Description>{todosCopy.subtitle}</Dialog.Description>
        </Dialog.Header>
        <ScrollArea class="h-0 min-h-0 flex-1">
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
        </ScrollArea>
        <Dialog.Footer class="mx-0 mb-0 shrink-0">
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
