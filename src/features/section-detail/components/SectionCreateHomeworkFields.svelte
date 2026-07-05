<script lang="ts">
import {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
} from "@/features/homeworks/lib/homework-limits";
import { campusReferenceMarkdownPlugins } from "@/features/markdown/lib/campus-reference-markdown";
import SectionHomeworkTagFields from "@/features/section-detail/components/SectionHomeworkTagFields.svelte";
import SectionHomeworkTimestampFields from "@/features/section-detail/components/SectionHomeworkTimestampFields.svelte";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
import * as Field from "$lib/components/ui/field/index.js";
import { Input } from "$lib/components/ui/input/index.js";
import type {
  SectionCreateHomeworkCommentsCopy,
  SectionCreateHomeworkFieldsCopy,
} from "./section-create-homework-types";

export let applyDueAtSemesterEnd: () => void;
export let applyDueInMonth: () => void;
export let applyDueInWeek: () => void;
export let applyPublishNow: () => void;
export let applyStartAtSemesterStart: () => void;
export let applyStartNow: () => void;
export let commentsCopy: SectionCreateHomeworkCommentsCopy;
export let hasSemesterEnd: boolean;
export let hasSemesterStart: boolean;
export let homeworkCopy: SectionCreateHomeworkFieldsCopy;
export let homeworkMessage: string;
export let publishedAt: string;
export let submissionDueAt: string;
export let submissionStartAt: string;
</script>

<Field.Group class="gap-4 px-5 py-4">
  <Field.Field>
    <Field.Label for="section-homework-title">
      {homeworkCopy.titleLabel}
    </Field.Label>
    <Input
      data-testid="section-homework-title"
      id="section-homework-title"
      maxlength={HOMEWORK_TITLE_MAX_LENGTH}
      name="title"
      placeholder={homeworkCopy.titlePlaceholder}
      required
    />
  </Field.Field>
  <Field.Field>
    <Field.Title id="section-homework-description-label">
      {homeworkCopy.descriptionLabel}
    </Field.Title>
    <MarkdownEditor
      aria-labelledby="section-homework-description-label"
      guideLabel={commentsCopy.markdownGuide}
      maxlength={HOMEWORK_DESCRIPTION_MAX_LENGTH}
      modeLabel={homeworkCopy.descriptionLabel}
      name="description"
      placeholder={homeworkCopy.descriptionPlaceholder}
      previewEmptyLabel={commentsCopy.previewEmpty}
      remarkPlugins={campusReferenceMarkdownPlugins}
      tabPreviewLabel={commentsCopy.tabPreview}
      tabWriteLabel={commentsCopy.tabWrite}
    />
  </Field.Field>
  <SectionHomeworkTimestampFields
    {applyDueAtSemesterEnd}
    {applyDueInMonth}
    {applyDueInWeek}
    {applyPublishNow}
    {applyStartAtSemesterStart}
    {applyStartNow}
    {hasSemesterEnd}
    {hasSemesterStart}
    {homeworkCopy}
    bind:publishedAt
    bind:submissionDueAt
    bind:submissionStartAt
  />
  <SectionHomeworkTagFields {homeworkCopy} idPrefix="section-create-homework" />
  {#if homeworkMessage}
    <Field.Error>{homeworkMessage}</Field.Error>
  {/if}
</Field.Group>
