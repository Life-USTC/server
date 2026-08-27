<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import type {
  DashboardHomeworkItem,
  DashboardHomeworksCopy,
} from "@/features/dashboard/lib/dashboard-controller-types";
import HomeworkDetailDialog from "@/features/homeworks/components/HomeworkDetailDialog.svelte";
import type { HomeworkDetailCommentsPanel } from "@/features/homeworks/components/homework-detail-types";
import { normalizeHomeworkDetail } from "@/features/homeworks/lib/homework-presentation";
import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import type {
  DashboardHomeworkCommentsCopy,
  DashboardHomeworkCreateSection,
  DashboardHomeworkCreateSectionGetter,
  DashboardHomeworkDateShortcut,
} from "./dashboard-homework-create-types";
import HomeworkCreateDialog from "./HomeworkCreateDialog.svelte";

type HomeworkAction = (homework: DashboardHomeworkItem) => string;

export let CommentsPanel: HomeworkDetailCommentsPanel;
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
export let fmtDate: (value: Date | string | null | undefined) => string;
export let homeworkCompletionActionLabel: HomeworkAction;
export let homeworkCourseLabel: HomeworkAction;
export let homeworkEtaLabel: (
  value: Date | string | null | undefined,
) => string;
export let homeworksCopy: DashboardHomeworksCopy;
export let homeworkSavingById: Record<string, boolean>;
export let homeworkSectionHref: HomeworkAction;
export let homeworkSectionLabel: (
  section: DashboardHomeworkCreateSection,
) => string;
export let homeworkStatus: HomeworkAction;
export let isCreatingHomework: boolean;
export let referenceDate: Date | string;
export let sections: DashboardHomeworkCreateSection[];
export let selectedCreateHomeworkSection: DashboardHomeworkCreateSectionGetter;
export let selectedHomework: DashboardHomeworkItem | null;
export let showCreateHomework: boolean;
export let toggleHomeworkCompletion: (
  homework: DashboardHomeworkItem,
) => void | Promise<void>;

$: selectedHomeworkDetail = selectedHomework
  ? normalizeHomeworkDetail(selectedHomework, {
      contextHref: homeworkSectionHref(selectedHomework),
      contextLabel: homeworkCourseLabel(selectedHomework),
    })
  : null;
$: selectedHomeworkPermalinkBaseHref = selectedHomework?.section?.jwId
  ? commentTargetPermalinkBaseHref({
      homeworkId: selectedHomework.id,
      sectionJwId: selectedHomework.section.jwId,
      type: "homework",
    })
  : null;
</script>

<HomeworkCreateDialog
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
  completionSaving={selectedHomework ? homeworkSavingById[selectedHomework.id] : false}
  contextHref={selectedHomeworkDetail?.contextHref}
  contextLabel={selectedHomeworkDetail?.contextLabel}
  copy={homeworksCopy}
  dateFallback={homeworksCopy.dateTBD}
  {fmtDate}
  homework={selectedHomeworkDetail}
  onClose={() => {
    selectedHomework = null;
  }}
  onToggleCompletion={() => {
    if (selectedHomework) return toggleHomeworkCompletion(selectedHomework);
  }}
  permalinkBaseHref={selectedHomeworkPermalinkBaseHref}
  relativeEtaLabel={homeworkEtaLabel}
  referenceDate={referenceDate}
  showCompletion={selectedHomework !== null}
/>
