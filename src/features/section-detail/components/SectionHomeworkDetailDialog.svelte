<script lang="ts">
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import HomeworkDetailDialog from "@/features/homeworks/components/HomeworkDetailDialog.svelte";
import type { HomeworkDetailCommentsPanel } from "@/features/homeworks/components/homework-detail-types";
import {
  formatHomeworkDueRelativeTime,
  normalizeHomeworkDetail,
} from "@/features/homeworks/lib/homework-presentation";
import SectionHomeworkActionBar from "./SectionHomeworkActionBar.svelte";
import SectionHomeworkAuditTrail from "./SectionHomeworkAuditTrail.svelte";
import SectionHomeworkEditForm from "./SectionHomeworkEditForm.svelte";
import type { FormatMessage } from "./section-detail-component-types";
import type {
  SectionHomeworkAction,
  SectionHomeworkAuditLookup,
  SectionHomeworkCommonCopy,
  SectionHomeworkCopy,
  SectionHomeworkDisplay,
  SectionHomeworkFormatter,
  SectionHomeworkMarkdownCopy,
  SectionHomeworkSectionCopy,
  SectionHomeworkSemesterDate,
  SectionHomeworkSubmitHandler,
  SectionHomeworkTimestampAction,
} from "./section-homework-display-types";

export let CommentsPanel: HomeworkDetailCommentsPanel;
export let _applyEditDueAtSemesterEnd: SectionHomeworkTimestampAction;
export let _applyEditDueInMonth: SectionHomeworkTimestampAction;
export let _applyEditDueInWeek: SectionHomeworkTimestampAction;
export let _applyEditPublishNow: SectionHomeworkTimestampAction;
export let _applyEditStartAtSemesterStart: SectionHomeworkTimestampAction;
export let _applyEditStartNow: SectionHomeworkTimestampAction;
export let _auditLogsForHomework: SectionHomeworkAuditLookup;
export let _canManageSelectedHomework: boolean;
export let _canWriteHomework: boolean;
export let _cancelEditHomework: () => void;
export let _commentsCopy: SectionHomeworkMarkdownCopy;
export let _commonCopy: SectionHomeworkCommonCopy;
export let _editHomeworkMessage: string;
export let _editHomeworkPublishedAt: string;
export let _editHomeworkSubmissionDueAt: string;
export let _editHomeworkSubmissionStartAt: string;
export let _editingHomework: boolean;
export let _fmtDateTime: SectionHomeworkFormatter;
export let _formatMessage: FormatMessage;
export let _homeworkAuditActionLabel: (action: string) => string;
export let _homeworkCopy: SectionHomeworkCopy;
export let _sectionCopy: SectionHomeworkSectionCopy & {
  due: string;
  notAvailable: string;
};
export let _selectedHomework: SectionHomeworkDisplay | null;
export let _semesterDate: SectionHomeworkSemesterDate;
export let _setDeleteHomeworkTarget: SectionHomeworkAction;
export let _startEditHomework: () => void;
export let _toggleHomeworkCompletion: SectionHomeworkAction;
export let _updateHomework: SectionHomeworkSubmitHandler;
export let close: () => void;
export let locale: string;
export let sectionLabel: string;
export let sectionJwId: number | string;

$: detailHomework = _selectedHomework
  ? normalizeHomeworkDetail(_selectedHomework, {
      contextLabel: sectionLabel,
    })
  : null;
$: permalinkBaseHref = _selectedHomework
  ? commentTargetPermalinkBaseHref({
      homeworkId: _selectedHomework.id,
      sectionJwId,
      type: "homework",
    })
  : null;
</script>

<HomeworkDetailDialog
  {CommentsPanel}
  completionSaving={false}
  copy={_homeworkCopy}
  dateFallback={_sectionCopy.notAvailable}
  editing={_editingHomework}
  fmtDate={_fmtDateTime}
  homework={detailHomework}
  onClose={close}
  onToggleCompletion={() => {
    if (_selectedHomework) return _toggleHomeworkCompletion(_selectedHomework);
  }}
  {permalinkBaseHref}
  relativeEtaLabel={(value) =>
    formatHomeworkDueRelativeTime(
      value,
      new Date(),
      locale,
      _sectionCopy.notAvailable,
    )}
  contextLabel={sectionLabel}
  showContextActions={_canWriteHomework || _canManageSelectedHomework}
  showCompletion={_canWriteHomework}
>
  {#snippet editingContent()}
    {#if _selectedHomework}
      <SectionHomeworkEditForm
        applyDueAtSemesterEnd={_applyEditDueAtSemesterEnd}
        applyDueInMonth={_applyEditDueInMonth}
        applyDueInWeek={_applyEditDueInWeek}
        applyPublishNow={_applyEditPublishNow}
        applyStartAtSemesterStart={_applyEditStartAtSemesterStart}
        applyStartNow={_applyEditStartNow}
        cancelEdit={_cancelEditHomework}
        commentsCopy={_commentsCopy}
        bind:editHomeworkMessage={_editHomeworkMessage}
        bind:editHomeworkPublishedAt={_editHomeworkPublishedAt}
        bind:editHomeworkSubmissionDueAt={_editHomeworkSubmissionDueAt}
        bind:editHomeworkSubmissionStartAt={_editHomeworkSubmissionStartAt}
        homework={_selectedHomework}
        homeworkCopy={_homeworkCopy}
        semesterDate={_semesterDate}
        updateHomework={_updateHomework}
      />
    {/if}
  {/snippet}
  {#snippet contextActions()}
    {#if _selectedHomework && (_canWriteHomework || _canManageSelectedHomework)}
      <SectionHomeworkActionBar
        canManage={_canManageSelectedHomework}
        canWrite={_canWriteHomework}
        cancelEdit={_cancelEditHomework}
        editing={_editingHomework}
        homework={_selectedHomework}
        homeworkCopy={_homeworkCopy}
        sectionCopy={_sectionCopy}
        setDeleteHomeworkTarget={_setDeleteHomeworkTarget}
        startEdit={_startEditHomework}
      />
    {/if}
  {/snippet}
  {#snippet additionalContent()}
    {#if _selectedHomework}
      <SectionHomeworkAuditTrail
        commonCopy={_commonCopy}
        fmtDateTime={_fmtDateTime}
        formatMessage={_formatMessage}
        homeworkAuditActionLabel={_homeworkAuditActionLabel}
        homeworkCopy={_homeworkCopy}
        logs={_auditLogsForHomework(_selectedHomework.id)}
      />
    {/if}
  {/snippet}
</HomeworkDetailDialog>
