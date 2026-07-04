<script lang="ts">
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as Field from "$lib/components/ui/field/index.js";
import type {
  DashboardHomeworkCreateCopy,
  DashboardHomeworkCreateSectionGetter,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";

export let applyHomeworkDueAtSemesterEnd: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInMonth: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInWeek: DashboardHomeworkDateShortcut;
export let createHomeworkSubmissionDueAt: string;
export let homeworksCopy: DashboardHomeworkCreateCopy;
export let isCreatingHomework: boolean;
export let selectedCreateHomeworkSection: DashboardHomeworkCreateSectionGetter;
</script>

<Field.Field>
  <Field.Title id="dashboard-homework-submission-due-label">
    {homeworksCopy.submissionDue}
  </Field.Title>
  <DateTimePicker
    aria-labelledby="dashboard-homework-submission-due-label"
    bind:value={createHomeworkSubmissionDueAt}
    calendarButtonLabel={homeworksCopy.calendarButtonLabel}
    disabled={isCreatingHomework}
    name="submissionDueAt"
    placeholder={homeworksCopy.submissionDue}
  />
  <div class="flex flex-wrap justify-end gap-2">
    <Button disabled={isCreatingHomework} size="sm" type="button" variant="ghost" onclick={applyHomeworkDueInWeek}>
      {homeworksCopy.helperWeek}
    </Button>
    <Button disabled={isCreatingHomework} size="sm" type="button" variant="ghost" onclick={applyHomeworkDueInMonth}>
      {homeworksCopy.helperMonth}
    </Button>
    <Button
      disabled={isCreatingHomework || !selectedCreateHomeworkSection()?.semesterEnd}
      size="sm"
      type="button"
      variant="ghost"
      onclick={applyHomeworkDueAtSemesterEnd}
    >
      {homeworksCopy.helperSemesterEnd}
    </Button>
  </div>
</Field.Field>
