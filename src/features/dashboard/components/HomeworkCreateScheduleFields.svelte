<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import type {
  DashboardHomeworkCreateCopy,
  DashboardHomeworkCreateSectionGetter,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";
import HomeworkCreateAdvancedDateFields from "./HomeworkCreateAdvancedDateFields.svelte";
import HomeworkCreateDueDateField from "./HomeworkCreateDueDateField.svelte";

export let applyHomeworkDueAtSemesterEnd: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInMonth: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInWeek: DashboardHomeworkDateShortcut;
export let applyHomeworkStartNow: DashboardHomeworkDateShortcut;
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkPublishedAt: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let homeworksCopy: DashboardHomeworkCreateCopy;
export let isCreatingHomework: boolean;
export let selectedCreateHomeworkSection: DashboardHomeworkCreateSectionGetter;
export let toShanghaiDateTimeLocalValue: (value: Date) => string;
</script>

<HomeworkCreateDueDateField
  {applyHomeworkDueAtSemesterEnd}
  {applyHomeworkDueInMonth}
  {applyHomeworkDueInWeek}
  bind:createHomeworkSubmissionDueAt
  {homeworksCopy}
  {isCreatingHomework}
  {selectedCreateHomeworkSection}
/>

<div class="flex justify-end">
  <Button
    disabled={isCreatingHomework}
    type="button"
    variant="ghost"
    onclick={() => {
      createHomeworkAdvancedOpen = !createHomeworkAdvancedOpen;
    }}
  >
    {createHomeworkAdvancedOpen
      ? homeworksCopy.advancedHide
      : homeworksCopy.advancedShow}
  </Button>
</div>

{#if createHomeworkAdvancedOpen}
  <HomeworkCreateAdvancedDateFields
    {applyHomeworkStartNow}
    bind:createHomeworkPublishedAt
    bind:createHomeworkSubmissionStartAt
    {homeworksCopy}
    {isCreatingHomework}
    {toShanghaiDateTimeLocalValue}
  />
{:else}
  <input name="publishedAt" type="hidden" value={createHomeworkPublishedAt} />
  <input
    name="submissionStartAt"
    type="hidden"
    value={createHomeworkSubmissionStartAt}
  />
{/if}
