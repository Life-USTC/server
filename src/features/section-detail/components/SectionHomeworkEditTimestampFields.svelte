<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
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
  <Field.Field>
    <Field.Title id="section-homework-edit-published-at-label">
      {homeworkCopy.publishedAt}
    </Field.Title>
    <DateTimePicker
      aria-labelledby="section-homework-edit-published-at-label"
      bind:value={editHomeworkPublishedAt}
      calendarButtonLabel={homeworkCopy.calendarButtonLabel}
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
  </Field.Field>
  <Field.Field>
    <Field.Title id="section-homework-edit-submission-start-label">
      {homeworkCopy.submissionStart}
    </Field.Title>
    <DateTimePicker
      aria-labelledby="section-homework-edit-submission-start-label"
      bind:value={editHomeworkSubmissionStartAt}
      calendarButtonLabel={homeworkCopy.calendarButtonLabel}
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
  </Field.Field>
  <Field.Field>
    <Field.Title id="section-homework-edit-submission-due-label">
      {homeworkCopy.submissionDue}
    </Field.Title>
    <DateTimePicker
      aria-labelledby="section-homework-edit-submission-due-label"
      bind:value={editHomeworkSubmissionDueAt}
      calendarButtonLabel={homeworkCopy.calendarButtonLabel}
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
  </Field.Field>
</div>
