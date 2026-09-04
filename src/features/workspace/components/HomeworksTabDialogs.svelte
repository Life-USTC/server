<script lang="ts">
import type { SubmitFunction } from "@sveltejs/kit";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import HomeworkDetailDialog from "@/features/homeworks/components/HomeworkDetailDialog.svelte";
import type { HomeworkDetailCommentsPanel } from "@/features/homeworks/components/homework-detail-types";
import {
  formatHomeworkDetailDateTime,
  formatHomeworkDueRelativeTime,
  normalizeHomeworkDetail,
} from "@/features/homeworks/lib/homework-presentation";
import type {
  WorkspaceHomeworkItem,
  WorkspaceHomeworksCopy,
} from "@/features/workspace/lib/workspace-controller-types";
import { toShanghaiDateTimeLocalValue } from "@/lib/time/shanghai-format";
import HomeworkCreateDialog from "./HomeworkCreateDialog.svelte";
import type {
  WorkspaceHomeworkCommentsCopy,
  WorkspaceHomeworkCreateSection,
  WorkspaceHomeworkCreateSectionGetter,
  WorkspaceHomeworkDateShortcut,
} from "./workspace-homework-create-types";

type HomeworkAction = (homework: WorkspaceHomeworkItem) => string;

export let CommentsPanel: HomeworkDetailCommentsPanel;
export let applyHomeworkDueAtSemesterEnd: WorkspaceHomeworkDateShortcut;
export let applyHomeworkDueInMonth: WorkspaceHomeworkDateShortcut;
export let applyHomeworkDueInWeek: WorkspaceHomeworkDateShortcut;
export let applyHomeworkStartNow: WorkspaceHomeworkDateShortcut;
export let commentsCopy: WorkspaceHomeworkCommentsCopy;
export let createHomeworkAction: SubmitFunction;
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: string;
export let createHomeworkSectionId: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let homeworkCourseLabel: HomeworkAction;
export let homeworksCopy: WorkspaceHomeworksCopy;
export let homeworkSavingById: Record<string, boolean>;
export let homeworkSectionHref: HomeworkAction;
export let homeworkSectionLabel: (
  section: WorkspaceHomeworkCreateSection,
) => string;
export let isCreatingHomework: boolean;
export let locale: string;
export let referenceDate: Date | string;
export let sections: WorkspaceHomeworkCreateSection[];
export let selectedCreateHomeworkSection: WorkspaceHomeworkCreateSectionGetter;
export let selectedHomework: WorkspaceHomeworkItem | null;
export let showCreateHomework: boolean;
export let toggleHomeworkCompletion: (
  homework: WorkspaceHomeworkItem,
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
  fmtDate={(value) =>
    formatHomeworkDetailDateTime(value, locale, homeworksCopy.dateTBD)}
  homework={selectedHomeworkDetail}
  onClose={() => {
    selectedHomework = null;
  }}
  onToggleCompletion={() => {
    if (selectedHomework) return toggleHomeworkCompletion(selectedHomework);
  }}
  permalinkBaseHref={selectedHomeworkPermalinkBaseHref}
  relativeEtaLabel={(value, liveReferenceDate) =>
    formatHomeworkDueRelativeTime(
      value,
      liveReferenceDate,
      locale,
      homeworksCopy.dateTBD,
    )}
  referenceDate={referenceDate}
  showCompletion={selectedHomework !== null}
/>
