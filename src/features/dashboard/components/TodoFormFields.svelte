<script lang="ts">
import type { CommentsCopy } from "@/features/comments/components/comment-component-types";
import type {
  DashboardTodoPriorityOption,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Input } from "$lib/components/ui/input/index.js";
import { Select } from "$lib/components/ui/select/index.js";

export let TODO_CONTENT_MAX_LENGTH: number;
export let TODO_TITLE_MAX_LENGTH: number;
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
  <Select
    {disabled}
    items={todoPriorityOptions}
    name="priority"
    value={priorityValue}
  />
</label>
<label class="grid gap-2">
  <span class="font-medium text-sm">{todosCopy.dueAtLabel}</span>
  <DateTimePicker
    {disabled}
    name="dueAt"
    placeholder={todosCopy.dueAtLabel}
    value={dueAtValue}
  />
</label>
<label class="grid gap-2">
  <span class="font-medium text-sm">{todosCopy.contentLabel}</span>
  <MarkdownEditor
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
</label>
