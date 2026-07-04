<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import type { SectionCreateHomeworkFieldsCopy } from "./section-create-homework-types";
import type { SectionHomeworkTimestampAction } from "./section-homework-display-types";

export let applyDueAtSemesterEnd: () => void;
export let applyDueInMonth: SectionHomeworkTimestampAction;
export let applyDueInWeek: SectionHomeworkTimestampAction;
export let applyPublishNow: SectionHomeworkTimestampAction;
export let applyStartAtSemesterStart: SectionHomeworkTimestampAction;
export let applyStartNow: SectionHomeworkTimestampAction;
export let hasSemesterEnd: boolean;
export let hasSemesterStart: boolean;
export let homeworkCopy: SectionCreateHomeworkFieldsCopy;
export let publishedAt: string;
export let submissionDueAt: string;
export let submissionStartAt: string;
</script>

<div class="grid gap-3 sm:grid-cols-3">
  <Field.Field>
    <Field.Title id="section-homework-published-at-label">
      {homeworkCopy.publishedAt}
    </Field.Title>
    <DateTimePicker
      aria-labelledby="section-homework-published-at-label"
      bind:value={publishedAt}
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
          publishedAt = "";
        }}
      >
        {homeworkCopy.helperClear}
      </Button>
    </div>
  </Field.Field>
  <Field.Field>
    <Field.Title id="section-homework-submission-start-label">
      {homeworkCopy.submissionStart}
    </Field.Title>
    <DateTimePicker
      aria-labelledby="section-homework-submission-start-label"
      bind:value={submissionStartAt}
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
        disabled={!hasSemesterStart}
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
          submissionStartAt = "";
        }}
      >
        {homeworkCopy.helperClear}
      </Button>
    </div>
  </Field.Field>
  <Field.Field>
    <Field.Title id="section-homework-submission-due-label">
      {homeworkCopy.submissionDue}
    </Field.Title>
    <DateTimePicker
      aria-labelledby="section-homework-submission-due-label"
      bind:value={submissionDueAt}
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
        disabled={!hasSemesterEnd}
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
