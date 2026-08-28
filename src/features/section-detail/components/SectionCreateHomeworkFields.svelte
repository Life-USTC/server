<script lang="ts">
import HomeworkEditorFields from "@/features/homeworks/components/HomeworkEditorFields.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import * as Field from "$lib/components/ui/field/index.js";
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
export let sectionLabel: string;
export let publishedAt: string;
export let submissionDueAt: string;
export let submissionStartAt: string;

let advancedOpen = false;

$: homeworkTimestampActions = {
  dueAtSemesterEnd: applyDueAtSemesterEnd,
  dueInMonth: applyDueInMonth,
  dueInWeek: applyDueInWeek,
  publishNow: applyPublishNow,
  startAtSemesterStart: applyStartAtSemesterStart,
  startNow: applyStartNow,
};
$: homeworkTimestampCapabilities = {
  hasSemesterEnd,
  hasSemesterStart,
};
</script>

<Field.Group class="gap-5 px-5 py-4 sm:px-6 sm:py-5">
  <Field.Field class="rounded-lg bg-muted/40 p-3">
    <Field.Title>{homeworkCopy.sectionLabel}</Field.Title>
    <p class="text-sm font-medium">{sectionLabel}</p>
  </Field.Field>
  <HomeworkEditorFields
    actions={homeworkTimestampActions}
    bind:advancedOpen={advancedOpen}
    capabilities={homeworkTimestampCapabilities}
    commentsCopy={commentsCopy}
    copy={homeworkCopy}
    idPrefix="section-homework"
    bind:publishedAt={publishedAt}
    styleGuidePrefix="section-create-homework"
    bind:submissionDueAt={submissionDueAt}
    bind:submissionStartAt={submissionStartAt}
  />
  {#if homeworkMessage}
    <Alert.Root variant="destructive">
      <Alert.Description>{homeworkMessage}</Alert.Description>
    </Alert.Root>
  {/if}
</Field.Group>
