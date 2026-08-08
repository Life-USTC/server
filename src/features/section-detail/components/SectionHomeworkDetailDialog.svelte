<script lang="ts">
import type { Component } from "svelte";
import { commentTargetPermalinkBaseHref } from "@/features/comments/lib/comment-panel-controller";
import DetailDialog from "$lib/components/DetailDialog.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import SectionHomeworkActionBar from "./SectionHomeworkActionBar.svelte";
import SectionHomeworkAuditTrail from "./SectionHomeworkAuditTrail.svelte";
import SectionHomeworkEditForm from "./SectionHomeworkEditForm.svelte";
import SectionHomeworkReadOnlySummary from "./SectionHomeworkReadOnlySummary.svelte";
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

export let CommentsPanel: Component<{
  heading?: string | null;
  permalinkBaseHref?: string | null;
  targetId: string;
  targetType: "homework";
}>;
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
export let _homeworkStatus: (homework: SectionHomeworkDisplay) => string;
export let _sectionCopy: SectionHomeworkSectionCopy & { due: string };
export let _selectedHomework: SectionHomeworkDisplay | null;
export let _semesterDate: SectionHomeworkSemesterDate;
export let _setDeleteHomeworkTarget: SectionHomeworkAction;
export let _startEditHomework: () => void;
export let _toggleHomeworkCompletion: SectionHomeworkAction;
export let _updateHomework: SectionHomeworkSubmitHandler;
export let close: () => void;
export let sectionJwId: number | string;
</script>

{#if _selectedHomework}
  {@const homework = _selectedHomework}
  <DetailDialog
    onClose={close}
    showFooter={!_editingHomework && (_canWriteHomework || _canManageSelectedHomework)}
    subtitle={`${_sectionCopy.due} · ${_fmtDateTime(homework.submissionDueAt)}`}
    title={homework.title}
  >
    {#snippet badges()}
      <Badge variant={homework.completion ? "default" : "outline"}>
        {_homeworkStatus(homework)}
      </Badge>
    {/snippet}

    {#snippet body()}
      {#if _editingHomework}
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
          {homework}
          homeworkCopy={_homeworkCopy}
          semesterDate={_semesterDate}
          updateHomework={_updateHomework}
        />
      {:else}
        <SectionHomeworkReadOnlySummary
          fmtDateTime={_fmtDateTime}
          {homework}
          homeworkCopy={_homeworkCopy}
        />
      {/if}

      <SectionHomeworkAuditTrail
        commonCopy={_commonCopy}
        fmtDateTime={_fmtDateTime}
        formatMessage={_formatMessage}
        homeworkAuditActionLabel={_homeworkAuditActionLabel}
        homeworkCopy={_homeworkCopy}
        logs={_auditLogsForHomework(homework.id)}
      />
    {/snippet}

    {#snippet aside()}
      {#key `comments:homework:${homework.id}`}
        <CommentsPanel
          heading={_homeworkCopy.commentsTitle}
          permalinkBaseHref={commentTargetPermalinkBaseHref({
            homeworkId: homework.id,
            sectionJwId,
            type: "homework",
          })}
          targetType="homework"
          targetId={homework.id}
        />
      {/key}
    {/snippet}

    {#snippet footer()}
      <SectionHomeworkActionBar
        canManage={_canManageSelectedHomework}
        canWrite={_canWriteHomework}
        {homework}
        homeworkCopy={_homeworkCopy}
        setDeleteHomeworkTarget={_setDeleteHomeworkTarget}
        startEdit={_startEditHomework}
        toggleHomeworkCompletion={_toggleHomeworkCompletion}
      />
    {/snippet}
  </DetailDialog>
{/if}
