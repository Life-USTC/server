<script lang="ts">
import DateTimePicker from "#lib/components/DateTimePicker.svelte";
import MarkdownEditor from "#lib/components/MarkdownEditor.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import { Button } from "#lib/components/ui/button/index.js";
import * as Dialog from "#lib/components/ui/dialog/index.js";
import * as Field from "#lib/components/ui/field/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import * as NativeSelect from "#lib/components/ui/native-select/index.js";
import { ScrollArea } from "#lib/components/ui/scroll-area/index.js";
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import {
  TODO_CONTENT_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
} from "@/features/todos/lib/todo-limits";
import type {
  WorkspaceTodoItem,
  WorkspaceTodoPriorityOption,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import { enhance, type SubmitFunction } from "$app/forms";

export let commentsCopy: CommentsCopy;
export let error: string;
export let saving: boolean;
export let onClose: () => void;
export let todo: WorkspaceTodoItem | null = null;
export let todoPriorityOptions: WorkspaceTodoPriorityOption[];
export let todosCopy: WorkspaceTodosCopy;
export let submit: SubmitFunction;
$: initialPriority = todo?.priority ?? "medium";
$: priorityValue = initialPriority;
$: idPrefix = todo ? "edit-todo" : "create-todo";
$: titleId = `${idPrefix}-title`;
$: priorityId = `${idPrefix}-priority`;
$: dueAtLabelId = `${idPrefix}-due-at-label`;
$: contentLabelId = `${idPrefix}-content-label`;
</script>

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
      action={todo ? "?/updateTodo" : "?/createTodo"}
      use:enhance={submit}
    >
      {#if todo}<input name="id" type="hidden" value={todo.id} />{/if}
      <Dialog.Header class="shrink-0 px-5 pb-2 pt-4"
        heading={todo ? todosCopy.editTitle : todosCopy.createTitle}
        description={todo ? todosCopy.editDescription : todosCopy.subtitle}
      />
      <ScrollArea class="h-0 min-h-0 flex-1">
        <Field.Group class="gap-4 px-5 py-4">
          {#if error}
            <Alert.Message variant="destructive">{error}</Alert.Message>
          {/if}
          <Field.Field data-disabled={saving ? "true" : undefined} for={titleId} label={todosCopy.titleLabel}>
            <Input
              id={titleId}
              disabled={saving}
              maxlength={TODO_TITLE_MAX_LENGTH}
              name="title"
              placeholder={todosCopy.titlePlaceholder}
              required
              value={todo?.title ?? ""}
            />
          </Field.Field>
          <Field.Field data-disabled={saving ? "true" : undefined} for={priorityId} label={todosCopy.priorityLabel}>
            <NativeSelect.Root
              bind:value={priorityValue}
              disabled={saving}
              class="w-full"
              id={priorityId}
              name="priority"
              options={todoPriorityOptions}
            />
          </Field.Field>
          <Field.Field data-disabled={saving ? "true" : undefined}>
            <Field.Title id={dueAtLabelId}>{todosCopy.dueAtLabel}</Field.Title>
            <DateTimePicker
              aria-labelledby={dueAtLabelId}
              disabled={saving}
              calendarButtonLabel={todosCopy.calendarButtonLabel}
              name="dueAt"
              placeholder={todosCopy.dueAtPlaceholder}
              value={toShanghaiDateTimeLocalValue(todo?.dueAt)}
            />
          </Field.Field>
          <Field.Field data-disabled={saving ? "true" : undefined}>
            <Field.Title id={contentLabelId}>{todosCopy.contentLabel}</Field.Title>
            <MarkdownEditor
              aria-labelledby={contentLabelId}
              disabled={saving}
              copy={commentsCopy}
              maxlength={TODO_CONTENT_MAX_LENGTH}
              modeLabel={commentsCopy.markdownModeLabel}
              name="content"
              placeholder={todosCopy.contentPlaceholder}
              value={todo?.content ?? ""}
            />
          </Field.Field>
        </Field.Group>
      </ScrollArea>
      <Dialog.Actions class="mx-0 mb-0 shrink-0" cancelLabel={todosCopy.cancel} onCancel={onClose} cancelDisabled={saving}>
        <Button loading={saving} disabled={saving} type="submit">
          {saving ? todosCopy.saving : todo ? todosCopy.saveChanges : todosCopy.createAction}
        </Button>
      </Dialog.Actions>
    </form>
  </Dialog.Content>
</Dialog.Root>
