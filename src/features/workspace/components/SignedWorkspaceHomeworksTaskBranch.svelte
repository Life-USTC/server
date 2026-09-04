<script lang="ts">
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import HomeworksTab from "./HomeworksTab.svelte";
import type { WorkspaceHomeworksTaskProps } from "./workspace-task-component-types";

export let applyHomeworkDueAtSemesterEnd: WorkspaceHomeworksTaskProps["applyHomeworkDueAtSemesterEnd"];
export let applyHomeworkDueInMonth: WorkspaceHomeworksTaskProps["applyHomeworkDueInMonth"];
export let applyHomeworkDueInWeek: WorkspaceHomeworksTaskProps["applyHomeworkDueInWeek"];
export let applyHomeworkStartNow: WorkspaceHomeworksTaskProps["applyHomeworkStartNow"];
export let commentsCopy: WorkspaceHomeworksTaskProps["commentsCopy"];
export let commonCopy: WorkspaceHomeworksTaskProps["commonCopy"];
export let createHomeworkAction: WorkspaceHomeworksTaskProps["createHomeworkAction"];
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: WorkspaceHomeworksTaskProps["createHomeworkPublishedAt"];
export let createHomeworkSectionId: WorkspaceHomeworksTaskProps["createHomeworkSectionId"];
export let createHomeworkSubmissionDueAt: WorkspaceHomeworksTaskProps["createHomeworkSubmissionDueAt"];
export let createHomeworkSubmissionStartAt: WorkspaceHomeworksTaskProps["createHomeworkSubmissionStartAt"];
export let workspaceCopy: WorkspaceHomeworksTaskProps["workspaceCopy"];
export let data: WorkspaceHomeworksTaskProps["data"];
export let homeworkActionError: WorkspaceHomeworksTaskProps["homeworkActionError"];
export let homeworkCopy: WorkspaceHomeworksTaskProps["homeworkCopy"];
export let homeworkFilter: WorkspaceHomeworksTaskProps["homeworkFilter"];
export let homeworkItems: WorkspaceHomeworksTaskProps["homeworkItems"];
export let homeworkReferenceDate: WorkspaceHomeworksTaskProps["homeworkReferenceDate"];
export let homeworkSavingById: WorkspaceHomeworksTaskProps["homeworkSavingById"];
export let homeworksCopy: WorkspaceHomeworksTaskProps["homeworksCopy"];
export let isCreatingHomework: boolean;
export let openCreateHomeworkDialog: WorkspaceHomeworksTaskProps["openCreateHomeworkDialog"];
export let sectionCopy: WorkspaceHomeworksTaskProps["sectionCopy"];
export let selectedCreateHomeworkSection: WorkspaceHomeworksTaskProps["selectedCreateHomeworkSection"];
export let selectedHomework: WorkspaceHomeworksTaskProps["selectedHomework"];
export let showCreateHomework: boolean;
export let signedData: WorkspaceHomeworksTaskProps["signedData"];
export let toggleHomeworkCompletion: WorkspaceHomeworksTaskProps["toggleHomeworkCompletion"];
</script>

<HomeworksTab
  {CommentsPanel}
  {commonCopy}
  {workspaceCopy}
  {sectionCopy}
  {homeworksCopy}
  {homeworkActionError}
  {homeworkCopy}
  {commentsCopy}
  {signedData}
  locale={data.locale}
  referenceDate={homeworkReferenceDate}
  {selectedCreateHomeworkSection}
  {openCreateHomeworkDialog}
  {applyHomeworkStartNow}
  {applyHomeworkDueInWeek}
  {applyHomeworkDueInMonth}
  {applyHomeworkDueAtSemesterEnd}
  {toggleHomeworkCompletion}
  {createHomeworkAction}
  bind:homeworkFilter
  bind:showCreateHomework
  bind:createHomeworkAdvancedOpen
  bind:createHomeworkPublishedAt
  bind:createHomeworkSectionId
  bind:createHomeworkSubmissionDueAt
  bind:createHomeworkSubmissionStartAt
  bind:selectedHomework
  bind:homeworkItems
  bind:homeworkSavingById
  bind:createHomeworkError
  bind:isCreatingHomework
/>
