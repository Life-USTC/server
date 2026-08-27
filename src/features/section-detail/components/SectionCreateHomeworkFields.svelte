<script lang="ts">
import HomeworkFormFields from "@/features/homeworks/components/HomeworkFormFields.svelte";
import HomeworkTagFields from "@/features/homeworks/components/HomeworkTagFields.svelte";
import HomeworkTimestampFields from "@/features/homeworks/components/HomeworkTimestampFields.svelte";
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

<Field.Group class="gap-4 px-5 py-4">
  <HomeworkFormFields
    commentsCopy={commentsCopy}
    copy={homeworkCopy}
    idPrefix="section-homework"
    styleGuidePrefix="section-create-homework"
  />
  <HomeworkTimestampFields
    actions={homeworkTimestampActions}
    bind:advancedOpen={advancedOpen}
    capabilities={homeworkTimestampCapabilities}
    copy={homeworkCopy}
    idPrefix="section-homework"
    bind:publishedAt={publishedAt}
    bind:submissionDueAt={submissionDueAt}
    bind:submissionStartAt={submissionStartAt}
  />
  <HomeworkTagFields copy={homeworkCopy} idPrefix="section-create-homework" />
  {#if homeworkMessage}
    <Alert.Root variant="destructive">
      <Alert.Description>{homeworkMessage}</Alert.Description>
    </Alert.Root>
  {/if}
</Field.Group>
