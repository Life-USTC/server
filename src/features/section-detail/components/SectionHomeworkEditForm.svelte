<script lang="ts">
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import { Checkbox } from "$lib/components/ui/checkbox/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import SectionHomeworkEditTimestampFields from "./SectionHomeworkEditTimestampFields.svelte";
import type {
  SectionHomeworkCopy,
  SectionHomeworkDisplay,
  SectionHomeworkMarkdownCopy,
  SectionHomeworkSemesterDate,
  SectionHomeworkSubmitHandler,
  SectionHomeworkTimestampAction,
} from "./section-homework-display-types";

export let applyDueAtSemesterEnd: SectionHomeworkTimestampAction;
export let applyDueInMonth: SectionHomeworkTimestampAction;
export let applyDueInWeek: SectionHomeworkTimestampAction;
export let applyPublishNow: SectionHomeworkTimestampAction;
export let applyStartAtSemesterStart: SectionHomeworkTimestampAction;
export let applyStartNow: SectionHomeworkTimestampAction;
export let cancelEdit: () => void;
export let commentsCopy: SectionHomeworkMarkdownCopy;
export let editHomeworkMessage: string;
export let editHomeworkPublishedAt: string;
export let editHomeworkSubmissionDueAt: string;
export let editHomeworkSubmissionStartAt: string;
export let homework: SectionHomeworkDisplay;
export let homeworkCopy: SectionHomeworkCopy;
export let semesterDate: SectionHomeworkSemesterDate;
export let updateHomework: SectionHomeworkSubmitHandler;
export let descriptionMaxLength: number;
export let titleMaxLength: number;
</script>

<form
  class="grid gap-4 rounded-md border border-base-300 bg-base-100 p-4"
  onsubmit={updateHomework}
>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworkCopy.titleLabel}</span>
    <Input
      maxlength={titleMaxLength}
      name="title"
      required
      value={homework.title}
    />
  </label>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworkCopy.descriptionLabel}</span>
    <MarkdownEditor
      guideLabel={commentsCopy.markdownGuide}
      maxlength={descriptionMaxLength}
      modeLabel={homeworkCopy.descriptionLabel}
      name="description"
      placeholder={homeworkCopy.descriptionPlaceholder}
      previewEmptyLabel={commentsCopy.previewEmpty}
      tabPreviewLabel={commentsCopy.tabPreview}
      tabWriteLabel={commentsCopy.tabWrite}
      value={homework.description?.content ?? ""}
    />
  </label>
  <SectionHomeworkEditTimestampFields
    {applyDueAtSemesterEnd}
    {applyDueInMonth}
    {applyDueInWeek}
    {applyPublishNow}
    {applyStartAtSemesterStart}
    {applyStartNow}
    bind:editHomeworkPublishedAt
    bind:editHomeworkSubmissionDueAt
    bind:editHomeworkSubmissionStartAt
    {homeworkCopy}
    {semesterDate}
  />
  <div class="flex flex-wrap gap-4">
    <label class="inline-flex items-center gap-2 text-sm">
      <Checkbox checked={homework.isMajor} name="isMajor" />
      <span>{homeworkCopy.tagMajor}</span>
    </label>
    <label class="inline-flex items-center gap-2 text-sm">
      <Checkbox checked={homework.requiresTeam} name="requiresTeam" />
      <span>{homeworkCopy.tagTeam}</span>
    </label>
  </div>
  {#if editHomeworkMessage}
    <p class="text-error text-sm">{editHomeworkMessage}</p>
  {/if}
  <div class="flex justify-end gap-2">
    <Button type="button" variant="outline" onclick={cancelEdit}>{homeworkCopy.cancel}</Button>
    <Button type="submit">{homeworkCopy.saveChanges}</Button>
  </div>
</form>
