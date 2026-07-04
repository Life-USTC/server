<script lang="ts">
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  DashboardTodoPriorityOption,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import {
  TODO_CONTENT_MAX_LENGTH,
  TODO_TITLE_MAX_LENGTH,
} from "@/features/todos/lib/todo-limits";
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import * as Select from "$lib/components/ui/select/index.js";

export let commentsCopy: CommentsCopy;
export let contentValue = "";
export let disabled = false;
export let dueAtValue = "";
export let idPrefix = "todo-form";
export let priorityValue = "medium";
export let titleValue = "";
export let todoPriorityOptions: DashboardTodoPriorityOption[];
export let todosCopy: DashboardTodosCopy;

$: titleId = `${idPrefix}-title`;
$: priorityId = `${idPrefix}-priority`;
$: dueAtLabelId = `${idPrefix}-due-at-label`;
$: contentLabelId = `${idPrefix}-content-label`;
</script>

<Field.Field>
  <Field.Label for={titleId}>{todosCopy.titleLabel}</Field.Label>
  <Input
    id={titleId}
    {disabled}
    maxlength={TODO_TITLE_MAX_LENGTH}
    name="title"
    required
    value={titleValue}
  />
</Field.Field>
<Field.Field>
  <Field.Label for={priorityId}>{todosCopy.priorityLabel}</Field.Label>
  <Select.Root
    bind:value={priorityValue}
    {disabled}
    name="priority"
    type="single"
  >
    <Select.Trigger id={priorityId} class="w-full">
      {todoPriorityOptions.find((option) => option.value === priorityValue)
        ?.label ?? todoPriorityOptions[0]?.label ?? ""}
    </Select.Trigger>
    <Select.Content>
      <Select.Group>
        {#each todoPriorityOptions as option}
          <Select.Item label={option.label} value={option.value}>
            {option.label}
          </Select.Item>
        {/each}
      </Select.Group>
    </Select.Content>
  </Select.Root>
</Field.Field>
<Field.Field>
  <Field.Title id={dueAtLabelId}>{todosCopy.dueAtLabel}</Field.Title>
  <DateTimePicker
    aria-labelledby={dueAtLabelId}
    {disabled}
    calendarButtonLabel={todosCopy.calendarButtonLabel}
    name="dueAt"
    placeholder={todosCopy.dueAtLabel}
    value={dueAtValue}
  />
</Field.Field>
<Field.Field>
  <Field.Title id={contentLabelId}>{todosCopy.contentLabel}</Field.Title>
  <MarkdownEditor
    aria-labelledby={contentLabelId}
    {disabled}
    guideLabel={commentsCopy.markdownGuide}
    maxlength={TODO_CONTENT_MAX_LENGTH}
    modeLabel={commentsCopy.markdownModeLabel}
    name="content"
    placeholder={todosCopy.contentPlaceholder}
    previewEmptyLabel={commentsCopy.previewEmpty}
    tabPreviewLabel={commentsCopy.tabPreview}
    tabWriteLabel={commentsCopy.tabWrite}
    value={contentValue}
  />
</Field.Field>
