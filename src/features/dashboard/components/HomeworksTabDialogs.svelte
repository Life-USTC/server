<script lang="ts">
// biome-ignore-all lint/suspicious/noExplicitAny: dashboard tab dialogs receive route-owned callbacks and page-shaped data.
import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import HomeworkCreateDialog from "./HomeworkCreateDialog.svelte";
import HomeworkDetailDialog from "./HomeworkDetailDialog.svelte";

export let CommentsPanel: any;
export let HOMEWORK_DESCRIPTION_MAX_LENGTH: number;
export let HOMEWORK_TITLE_MAX_LENGTH: number;
export let applyHomeworkDueAtSemesterEnd: any;
export let applyHomeworkDueInMonth: any;
export let applyHomeworkDueInWeek: any;
export let applyHomeworkStartNow: any;
export let commentsCopy: any;
export let createHomeworkAction: any;
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: any;
export let createHomeworkSectionId: any;
export let createHomeworkSubmissionDueAt: any;
export let createHomeworkSubmissionStartAt: any;
export let fmtDate: any;
export let homeworkCompletionActionLabel: any;
export let homeworkCopy: any;
export let homeworkCourseLabel: any;
export let homeworkDetailHref: any;
export let homeworkEtaLabel: any;
export let homeworksCopy: any;
export let homeworkSavingById: any;
export let homeworkSectionHref: any;
export let homeworkSectionLabel: any;
export let homeworkStatus: any;
export let isCreatingHomework: boolean;
export let selectedCreateHomeworkSection: any;
export let selectedHomework: any;
export let showCreateHomework: boolean;
export let signedData: any;
export let toggleHomeworkCompletion: any;
</script>

<HomeworkCreateDialog
  {HOMEWORK_DESCRIPTION_MAX_LENGTH}
  {HOMEWORK_TITLE_MAX_LENGTH}
  {applyHomeworkDueAtSemesterEnd}
  {applyHomeworkDueInMonth}
  {applyHomeworkDueInWeek}
  {applyHomeworkStartNow}
  {commentsCopy}
  {createHomeworkAction}
  bind:createHomeworkAdvancedOpen
  bind:createHomeworkPublishedAt
  bind:createHomeworkSectionId
  bind:createHomeworkSubmissionDueAt
  bind:createHomeworkSubmissionStartAt
  {homeworkSectionLabel}
  {homeworksCopy}
  {isCreatingHomework}
  onClose={() => {
    showCreateHomework = false;
    createHomeworkError = "";
  }}
  open={showCreateHomework}
  sections={signedData.homeworks.sections}
  {selectedCreateHomeworkSection}
  {toShanghaiDateTimeLocalValue}
  {createHomeworkError}
/>

<HomeworkDetailDialog
  {CommentsPanel}
  {fmtDate}
  homework={selectedHomework}
  {homeworkCompletionActionLabel}
  {homeworkDetailHref}
  {homeworkEtaLabel}
  {homeworkCourseLabel}
  {homeworkSavingById}
  {homeworkSectionHref}
  {homeworksCopy}
  {homeworkCopy}
  {homeworkStatus}
  onClose={() => {
    selectedHomework = null;
  }}
  {toggleHomeworkCompletion}
/>
