<script lang="ts">
import SectionHomeworkTagFields from "@/features/section-detail/components/SectionHomeworkTagFields.svelte";
import SectionHomeworkTimestampFields from "@/features/section-detail/components/SectionHomeworkTimestampFields.svelte";
import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
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
export let descriptionMaxLength: number;
export let hasSemesterEnd: boolean;
export let hasSemesterStart: boolean;
export let homeworkCopy: SectionCreateHomeworkFieldsCopy;
export let homeworkMessage: string;
export let publishedAt: string;
export let submissionDueAt: string;
export let submissionStartAt: string;
export let titleMaxLength: number;
</script>

<div class="grid gap-4 px-5 py-4">
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworkCopy.titleLabel}</span>
    <Input
      data-testid="section-homework-title"
      maxlength={titleMaxLength}
      name="title"
      placeholder={homeworkCopy.titlePlaceholder}
      required
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
    />
  </label>
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
  <SectionHomeworkTagFields {homeworkCopy} />
  {#if homeworkMessage}
    <p class="text-error text-sm">{homeworkMessage}</p>
  {/if}
</div>
