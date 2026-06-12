<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Button } from "$lib/components/ui/button/index.js";
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
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworkCopy.publishedAt}</span>
    <DateTimePicker
      bind:value={publishedAt}
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
  </label>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworkCopy.submissionStart}</span>
    <DateTimePicker
      bind:value={submissionStartAt}
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
  </label>
  <label class="grid gap-2">
    <span class="font-medium text-sm">{homeworkCopy.submissionDue}</span>
    <DateTimePicker
      bind:value={submissionDueAt}
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
  </label>
</div>
