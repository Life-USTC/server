<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import type {
  SectionHomeworkCopy,
  SectionHomeworkSemesterDate,
  SectionHomeworkTimestampAction,
} from "./section-homework-display-types";

export let applyDueAtSemesterEnd: SectionHomeworkTimestampAction;
export let applyDueInMonth: SectionHomeworkTimestampAction;
export let applyDueInWeek: SectionHomeworkTimestampAction;
export let applyPublishNow: SectionHomeworkTimestampAction;
export let applyStartAtSemesterStart: SectionHomeworkTimestampAction;
export let applyStartNow: SectionHomeworkTimestampAction;
export let editHomeworkPublishedAt: string;
export let editHomeworkSubmissionDueAt: string;
export let editHomeworkSubmissionStartAt: string;
export let homeworkCopy: SectionHomeworkCopy;
export let semesterDate: SectionHomeworkSemesterDate;
</script>

<div class="grid gap-3 sm:grid-cols-3">
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworkCopy.publishedAt}</span>
    <DateTimePicker
      bind:value={editHomeworkPublishedAt}
      defaultTime="00:00"
      name="publishedAt"
      placeholder={homeworkCopy.publishedAt}
    />
    <div class="flex flex-wrap justify-end gap-2">
      <Button size="sm" type="button" variant="ghost" onclick={applyPublishNow}>
        {homeworkCopy.helperPublishNow}
      </Button>
      <Button
        size="sm"
        type="button"
        variant="ghost"
        onclick={() => {
          editHomeworkPublishedAt = "";
        }}
      >
        {homeworkCopy.helperClear}
      </Button>
    </div>
  </label>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworkCopy.submissionStart}</span>
    <DateTimePicker
      bind:value={editHomeworkSubmissionStartAt}
      defaultTime="00:00"
      name="submissionStartAt"
      placeholder={homeworkCopy.submissionStart}
    />
    <div class="flex flex-wrap justify-end gap-2">
      <Button size="sm" type="button" variant="ghost" onclick={applyStartNow}>
        {homeworkCopy.helperStartNow}
      </Button>
      <Button
        disabled={!semesterDate("start")}
        size="sm"
        type="button"
        variant="ghost"
        onclick={applyStartAtSemesterStart}
      >
        {homeworkCopy.helperSemesterStart}
      </Button>
      <Button
        size="sm"
        type="button"
        variant="ghost"
        onclick={() => {
          editHomeworkSubmissionStartAt = "";
        }}
      >
        {homeworkCopy.helperClear}
      </Button>
    </div>
  </label>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworkCopy.submissionDue}</span>
    <DateTimePicker
      bind:value={editHomeworkSubmissionDueAt}
      name="submissionDueAt"
      placeholder={homeworkCopy.submissionDue}
    />
    <div class="flex flex-wrap justify-end gap-2">
      <Button size="sm" type="button" variant="ghost" onclick={applyDueInWeek}>
        {homeworkCopy.helperWeek}
      </Button>
      <Button size="sm" type="button" variant="ghost" onclick={applyDueInMonth}>
        {homeworkCopy.helperMonth}
      </Button>
      <Button
        disabled={!semesterDate("end")}
        size="sm"
        type="button"
        variant="ghost"
        onclick={applyDueAtSemesterEnd}
      >
        {homeworkCopy.helperSemesterEnd}
      </Button>
    </div>
  </label>
</div>
