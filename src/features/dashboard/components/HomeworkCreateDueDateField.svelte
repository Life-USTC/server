<script lang="ts">
import CalendarClock from "@lucide/svelte/icons/calendar-clock";
import DateTimePicker from "$lib/components/DateTimePicker.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
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

<Field.Field data-disabled={isCreatingHomework ? "true" : undefined}>
  <Field.Title id="dashboard-homework-submission-due-label">
    {homeworksCopy.submissionDue}
  </Field.Title>
  <DateTimePicker
    aria-labelledby="dashboard-homework-submission-due-label"
    bind:value={createHomeworkSubmissionDueAt}
    calendarButtonLabel={homeworksCopy.calendarButtonLabel}
    disabled={isCreatingHomework}
    name="submissionDueAt"
  />
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          class="ml-auto"
          disabled={isCreatingHomework}
          size="sm"
          type="button"
          variant="outline"
        >
          <CalendarClock data-icon="inline-start" />
          {homeworksCopy.dueDateShortcuts}
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end">
      <DropdownMenu.Group>
        <DropdownMenu.Item disabled={isCreatingHomework} onSelect={applyHomeworkDueInWeek}>
          {homeworksCopy.helperWeek}
        </DropdownMenu.Item>
        <DropdownMenu.Item disabled={isCreatingHomework} onSelect={applyHomeworkDueInMonth}>
          {homeworksCopy.helperMonth}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={isCreatingHomework || !selectedCreateHomeworkSection()?.semesterEnd}
          onSelect={applyHomeworkDueAtSemesterEnd}
        >
          {homeworksCopy.helperSemesterEnd}
        </DropdownMenu.Item>
      </DropdownMenu.Group>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</Field.Field>
