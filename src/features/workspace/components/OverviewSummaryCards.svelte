<script lang="ts">
import { WORKSPACE_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import type {
  WorkspaceCommonCopy,
  WorkspaceCopy,
  WorkspaceHomeworkItem,
  WorkspaceOverviewExamItem,
  WorkspaceSectionCopy,
  WorkspaceTodoItem,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import OverviewExamSummaryCard from "./OverviewExamSummaryCard.svelte";
import OverviewHomeworkSummaryCard from "./OverviewHomeworkSummaryCard.svelte";
import OverviewTodoSummaryCard from "./OverviewTodoSummaryCard.svelte";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let commonCopy: WorkspaceCommonCopy;
export let workspaceCopy: WorkspaceCopy;
export let sectionCopy: WorkspaceSectionCopy;
export let todosCopy: WorkspaceTodosCopy;
export let workspaceTabHref: WorkspaceCalendarTabHref;
export let fmtDate: (date: Date | string | null | undefined) => string;
export let homeworkEtaLabel: (date: Date | string | null | undefined) => string;
export let calendarExamDetail: (exam: WorkspaceOverviewExamItem) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string | number>,
) => string;
export let todoStatus: (todo: WorkspaceTodoItem) => string;
export let pendingHomeworks: WorkspaceHomeworkItem[];
export let pendingTodos: WorkspaceTodoItem[];
export let todosDueToday: WorkspaceTodoItem[];
export let todosDueSoon: WorkspaceTodoItem[];
export let upcomingExams: WorkspaceOverviewExamItem[];
export let examsCount: number;
export let previewLimit = WORKSPACE_OVERVIEW_PREVIEW_LIMIT;
export let viewAllLabel = "View all";
</script>

<div class="grid gap-8 lg:grid-cols-3 lg:gap-6">
  <OverviewHomeworkSummaryCard
    {commonCopy}
    {workspaceCopy}
    {workspaceTabHref}
    {fmtDate}
    {homeworkEtaLabel}
    {pendingHomeworks}
    {previewLimit}
    {viewAllLabel}
  />

  <OverviewTodoSummaryCard
    {workspaceCopy}
    {workspaceTabHref}
    {fmtDate}
    {formatMessage}
    {pendingTodos}
    {previewLimit}
    {todosCopy}
    {todosDueSoon}
    {todosDueToday}
    {todoStatus}
    {viewAllLabel}
  />

  <OverviewExamSummaryCard
    {calendarExamDetail}
    {workspaceCopy}
    {workspaceTabHref}
    {examsCount}
    {fmtDate}
    {previewLimit}
    {sectionCopy}
    {upcomingExams}
    {viewAllLabel}
  />
</div>
