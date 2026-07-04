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
import { Input } from "$lib/components/ui/input/index.js";
import * as Select from "$lib/components/ui/select/index.js";

export let commentsCopy: CommentsCopy;
export let contentValue = "";
export let disabled = false;
export let dueAtValue = "";
export let priorityValue = "medium";
export let titleValue = "";
export let todoPriorityOptions: DashboardTodoPriorityOption[];
export let todosCopy: DashboardTodosCopy;
</script>

<label class="grid gap-2">
  <span class="font-medium text-sm">{todosCopy.titleLabel}</span>
  <Input
    {disabled}
    maxlength={TODO_TITLE_MAX_LENGTH}
    name="title"
    required
    value={titleValue}
  />
</label>
<label class="grid gap-2">
  <span class="font-medium text-sm">{todosCopy.priorityLabel}</span>
  <Select.Root
    bind:value={priorityValue}
    {disabled}
    name="priority"
    type="single"
  >
    <Select.Trigger class="w-full">
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
</label>
<div class="grid gap-2">
  <span class="font-medium text-sm">{todosCopy.dueAtLabel}</span>
  <DateTimePicker
    aria-label={todosCopy.dueAtLabel}
    {disabled}
    calendarButtonLabel={todosCopy.calendarButtonLabel}
    name="dueAt"
    placeholder={todosCopy.dueAtLabel}
    value={dueAtValue}
  />
</div>
<div class="grid gap-2">
  <span class="font-medium text-sm">{todosCopy.contentLabel}</span>
  <MarkdownEditor
    aria-label={todosCopy.contentLabel}
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
</div>
