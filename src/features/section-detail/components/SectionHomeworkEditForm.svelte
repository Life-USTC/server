<script lang="ts">
import HomeworkEditorFields from "@/features/homeworks/components/HomeworkEditorFields.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
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
  hasSemesterEnd: Boolean(semesterDate("end")),
  hasSemesterStart: Boolean(semesterDate("start")),
};
</script>

<form
  class="flex flex-col"
  onsubmit={updateHomework}
>
  <Field.Group>
    <HomeworkEditorFields
      actions={homeworkTimestampActions}
      bind:advancedOpen={advancedOpen}
      capabilities={homeworkTimestampCapabilities}
      commentsCopy={commentsCopy}
      copy={homeworkCopy}
      description={homework.description?.content ?? ""}
      idPrefix="section-homework-edit"
      isMajor={homework.isMajor}
      bind:publishedAt={editHomeworkPublishedAt}
      requiresTeam={homework.requiresTeam}
      styleGuidePrefix="section-edit-homework"
      bind:submissionDueAt={editHomeworkSubmissionDueAt}
      bind:submissionStartAt={editHomeworkSubmissionStartAt}
      title={homework.title}
    />
    {#if editHomeworkMessage}
      <Alert.Root variant="destructive">
        <Alert.Description>{editHomeworkMessage}</Alert.Description>
      </Alert.Root>
    {/if}
    <div class="flex justify-end gap-2 pt-1">
      <Button type="button" variant="outline" onclick={cancelEdit}>{homeworkCopy.cancel}</Button>
      <Button type="submit">{homeworkCopy.saveChanges}</Button>
    </div>
  </Field.Group>
</form>
