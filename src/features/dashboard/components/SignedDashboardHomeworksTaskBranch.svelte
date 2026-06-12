<script lang="ts">
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import type { DashboardHomeworksTaskProps } from "./dashboard-task-component-types";
import HomeworksTab from "./HomeworksTab.svelte";

export let applyHomeworkDueAtSemesterEnd: DashboardHomeworksTaskProps["applyHomeworkDueAtSemesterEnd"];
export let applyHomeworkDueInMonth: DashboardHomeworksTaskProps["applyHomeworkDueInMonth"];
export let applyHomeworkDueInWeek: DashboardHomeworksTaskProps["applyHomeworkDueInWeek"];
export let applyHomeworkStartNow: DashboardHomeworksTaskProps["applyHomeworkStartNow"];
export let commentsCopy: DashboardHomeworksTaskProps["commentsCopy"];
export let commonCopy: DashboardHomeworksTaskProps["commonCopy"];
export let createHomeworkAction: DashboardHomeworksTaskProps["createHomeworkAction"];
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: DashboardHomeworksTaskProps["createHomeworkPublishedAt"];
export let createHomeworkSectionId: DashboardHomeworksTaskProps["createHomeworkSectionId"];
export let createHomeworkSubmissionDueAt: DashboardHomeworksTaskProps["createHomeworkSubmissionDueAt"];
export let createHomeworkSubmissionStartAt: DashboardHomeworksTaskProps["createHomeworkSubmissionStartAt"];
export let dashboardCopy: DashboardHomeworksTaskProps["dashboardCopy"];
export let data: DashboardHomeworksTaskProps["data"];
export let homeworkCopy: DashboardHomeworksTaskProps["homeworkCopy"];
export let homeworkDescriptionMaxLength: number;
export let homeworkFilter: DashboardHomeworksTaskProps["homeworkFilter"];
export let homeworkItems: DashboardHomeworksTaskProps["homeworkItems"];
export let homeworkReferenceDate: DashboardHomeworksTaskProps["homeworkReferenceDate"];
export let homeworkSavingById: DashboardHomeworksTaskProps["homeworkSavingById"];
export let homeworkTitleMaxLength: number;
export let homeworkView: DashboardHomeworksTaskProps["homeworkView"];
export let homeworksCopy: DashboardHomeworksTaskProps["homeworksCopy"];
export let isCreatingHomework: boolean;
export let openCreateHomeworkDialog: DashboardHomeworksTaskProps["openCreateHomeworkDialog"];
export let sectionCopy: DashboardHomeworksTaskProps["sectionCopy"];
export let selectedCreateHomeworkSection: DashboardHomeworksTaskProps["selectedCreateHomeworkSection"];
export let selectedHomework: DashboardHomeworksTaskProps["selectedHomework"];
export let setHomeworkView: DashboardHomeworksTaskProps["setHomeworkView"];
export let showCreateHomework: boolean;
export let signedData: DashboardHomeworksTaskProps["signedData"];
export let toggleHomeworkCompletion: DashboardHomeworksTaskProps["toggleHomeworkCompletion"];
</script>

<HomeworksTab
  {CommentsPanel}
  {commonCopy}
  {dashboardCopy}
  {sectionCopy}
  {homeworksCopy}
  {homeworkCopy}
  {commentsCopy}
  {signedData}
  HOMEWORK_TITLE_MAX_LENGTH={homeworkTitleMaxLength}
  HOMEWORK_DESCRIPTION_MAX_LENGTH={homeworkDescriptionMaxLength}
  locale={data.locale}
  referenceDate={homeworkReferenceDate}
  {selectedCreateHomeworkSection}
  {openCreateHomeworkDialog}
  {applyHomeworkStartNow}
  {applyHomeworkDueInWeek}
  {applyHomeworkDueInMonth}
  {applyHomeworkDueAtSemesterEnd}
  {toggleHomeworkCompletion}
  {setHomeworkView}
  {createHomeworkAction}
  bind:homeworkFilter
  bind:homeworkView
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
