<script lang="ts">
import {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
} from "@/features/homeworks/lib/homework-limits";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import SectionHomeworkEditTimestampFields from "./SectionHomeworkEditTimestampFields.svelte";
import SectionHomeworkTagFields from "./SectionHomeworkTagFields.svelte";
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
</script>

<form
  class="flex flex-col gap-4 rounded-md border bg-background p-4"
  onsubmit={updateHomework}
>
  <Field.Group class="gap-4">
    <Field.Field>
      <Field.Label for="section-homework-edit-title">
        {homeworkCopy.titleLabel}
      </Field.Label>
      <Input
        id="section-homework-edit-title"
        maxlength={HOMEWORK_TITLE_MAX_LENGTH}
        name="title"
        required
        value={homework.title}
      />
    </Field.Field>
    <Field.Field>
      <Field.Title id="section-homework-edit-description-label">
        {homeworkCopy.descriptionLabel}
      </Field.Title>
      <MarkdownEditor
        aria-labelledby="section-homework-edit-description-label"
        guideLabel={commentsCopy.markdownGuide}
        maxlength={HOMEWORK_DESCRIPTION_MAX_LENGTH}
        modeLabel={homeworkCopy.descriptionLabel}
        name="description"
        placeholder={homeworkCopy.descriptionPlaceholder}
        previewEmptyLabel={commentsCopy.previewEmpty}
        remarkPlugins={campusReferenceMarkdownPlugins}
        tabPreviewLabel={commentsCopy.tabPreview}
        tabWriteLabel={commentsCopy.tabWrite}
        value={homework.description?.content ?? ""}
      />
    </Field.Field>
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
    <SectionHomeworkTagFields
      {homeworkCopy}
      idPrefix="section-edit-homework"
      isMajor={homework.isMajor}
      requiresTeam={homework.requiresTeam}
    />
  </Field.Group>
  {#if editHomeworkMessage}
    <Field.Error>{editHomeworkMessage}</Field.Error>
  {/if}
  <div class="flex justify-end gap-2">
    <Button type="button" variant="outline" onclick={cancelEdit}>{homeworkCopy.cancel}</Button>
    <Button type="submit">{homeworkCopy.saveChanges}</Button>
  </div>
</form>
