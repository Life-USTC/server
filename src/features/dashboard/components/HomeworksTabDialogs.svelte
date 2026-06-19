<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import type {
  DashboardHomeworkItem,
  DashboardHomeworksCopy,
  DashboardMyHomeworksCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import type {
  DashboardHomeworkCommentsCopy,
  DashboardHomeworkCreateSection,
  DashboardHomeworkCreateSectionGetter,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";
import type {
  DashboardHomeworkCommentsPanel,
  DashboardHomeworkDetailFormatter,
} from "./dashboard-homework-detail-types";
import HomeworkCreateDialog from "./HomeworkCreateDialog.svelte";
import HomeworkDetailDialog from "./HomeworkDetailDialog.svelte";

type HomeworkAction = (homework: DashboardHomeworkItem) => string;

export let CommentsPanel: DashboardHomeworkCommentsPanel;
export let HOMEWORK_DESCRIPTION_MAX_LENGTH: number;
export let HOMEWORK_TITLE_MAX_LENGTH: number;
export let applyHomeworkDueAtSemesterEnd: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInMonth: DashboardHomeworkDateShortcut;
export let applyHomeworkDueInWeek: DashboardHomeworkDateShortcut;
export let applyHomeworkStartNow: DashboardHomeworkDateShortcut;
export let commentsCopy: DashboardHomeworkCommentsCopy;
export let createHomeworkAction: SubmitFunction;
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: string;
export let createHomeworkSectionId: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let fmtDate: DashboardHomeworkDetailFormatter;
export let homeworkCompletionActionLabel: HomeworkAction;
export let homeworkCopy: DashboardMyHomeworksCopy;
export let homeworkCourseLabel: HomeworkAction;
export let homeworkDetailHref: HomeworkAction;
export let homeworkEtaLabel: DashboardHomeworkDetailFormatter;
export let homeworksCopy: DashboardHomeworksCopy;
export let homeworkSavingById: Record<string, boolean>;
export let homeworkSectionHref: HomeworkAction;
export let homeworkSectionLabel: (
  section: DashboardHomeworkCreateSection,
) => string;
export let homeworkStatus: HomeworkAction;
export let isCreatingHomework: boolean;
export let sections: DashboardHomeworkCreateSection[];
export let selectedCreateHomeworkSection: DashboardHomeworkCreateSectionGetter;
export let selectedHomework: DashboardHomeworkItem | null;
export let showCreateHomework: boolean;
export let toggleHomeworkCompletion: (
  homework: DashboardHomeworkItem,
) => void | Promise<void>;
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
  {sections}
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
