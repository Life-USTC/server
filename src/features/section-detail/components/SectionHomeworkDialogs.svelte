<script lang="ts">
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
import type { HomeworkShortcuts } from "../lib/section-detail-homework-timestamp-actions";
import SectionCreateHomeworkDialog from "./SectionCreateHomeworkDialog.svelte";
import SectionHomeworkAuditDialog from "./SectionHomeworkAuditDialog.svelte";
import SectionHomeworkDeleteDialog from "./SectionHomeworkDeleteDialog.svelte";
import SectionHomeworkDetailDialog from "./SectionHomeworkDetailDialog.svelte";
import type {
  BooleanSetter,
  FormatMessage,
} from "./section-detail-component-types";
import type { SectionDetailHomeworkDialogsProps } from "./section-detail-dialog-types";

export let createShortcuts: HomeworkShortcuts;
export let editShortcuts: HomeworkShortcuts;
export let showPersonalStatus = false;
export let readOnlyReason: string | null | undefined = null;
export let referenceDate: string | undefined = undefined;
export let classSectionJwId: number | string | null | undefined = undefined;
export let classStarts: string[] = [];
export let auditLogsForHomework: SectionDetailHomeworkDialogsProps["auditLogsForHomework"];
export let canManageSelectedHomework: boolean;
export let canWriteHomework: boolean;
export let completionSaving: boolean;
export let cancelEditHomework: SectionDetailHomeworkDialogsProps["cancelEditHomework"];
export let closeCreateHomeworkDialog: SectionDetailHomeworkDialogsProps["closeCreateHomeworkDialog"];
export let commentsCopy: SectionDetailHomeworkDialogsProps["commentsCopy"];
export let commonCopy: SectionDetailHomeworkDialogsProps["commonCopy"];
export let createHomework: SectionDetailHomeworkDialogsProps["createHomework"];
export let createHomeworkPublishedAt: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let deleteHomework: SectionDetailHomeworkDialogsProps["deleteHomework"];
export let deleteHomeworkTarget: SectionDetailHomeworkDialogsProps["deleteHomeworkTarget"];
export let editHomeworkMessage: string;
export let editHomeworkPublishedAt: string;
export let editHomeworkSubmissionDueAt: string;
export let editHomeworkSubmissionStartAt: string;
export let editingHomework: boolean;
export let fmtDateTime: SectionDetailHomeworkDialogsProps["fmtDateTime"];
export let formatMessage: FormatMessage;
export let hasSemesterEnd: boolean;
export let hasSemesterStart: boolean;
export let homeworkAuditActionLabel: SectionDetailHomeworkDialogsProps["homeworkAuditActionLabel"];
export let homeworkAuditActorName: SectionDetailHomeworkDialogsProps["homeworkAuditActorName"];
export let homeworkAuditLogs: SectionDetailHomeworkDialogsProps["homeworkAuditLogs"];
export let homeworkCopy: SectionDetailHomeworkDialogsProps["homeworkCopy"];
export let homeworkMessage: string;
export let isHomeworkAuditDialogOpen: boolean;
export let locale: string;
export let sectionCopy: SectionDetailHomeworkDialogsProps["sectionCopy"];
export let sectionLabel: string;
export let sectionJwId: number | string;
export let selectedHomework: SectionDetailHomeworkDialogsProps["selectedHomework"];
export let semesterDate: SectionDetailHomeworkDialogsProps["semesterDate"];
export let setDeleteHomeworkTarget: SectionDetailHomeworkDialogsProps["setDeleteHomeworkTarget"];
export let setHomeworkAuditDialogOpen: BooleanSetter;
export let setSelectedHomework: SectionDetailHomeworkDialogsProps["setSelectedHomework"];
export let showCreateHomework: boolean;
export let startEditHomework: SectionDetailHomeworkDialogsProps["startEditHomework"];
export let toggleHomeworkCompletion: SectionDetailHomeworkDialogsProps["toggleHomeworkCompletion"];
export let updateHomework: SectionDetailHomeworkDialogsProps["updateHomework"];
</script>

<SectionCreateHomeworkDialog
  {classSectionJwId}
  {classStarts}
  {locale}
  shortcuts={createShortcuts}





  close={closeCreateHomeworkDialog}
  {commentsCopy}
  {createHomework}
  {hasSemesterEnd}
  {hasSemesterStart}
  {homeworkCopy}
  {homeworkMessage}
  bind:publishedAt={createHomeworkPublishedAt}
  {sectionLabel}
  show={showCreateHomework}
  bind:submissionDueAt={createHomeworkSubmissionDueAt}
  bind:submissionStartAt={createHomeworkSubmissionStartAt}
/>

<SectionHomeworkDetailDialog
  {showPersonalStatus}
  {classSectionJwId}
  {classStarts}
  {readOnlyReason}
  {referenceDate}
  {CommentsPanel}
  shortcuts={editShortcuts}





  _auditLogsForHomework={auditLogsForHomework}
  _canManageSelectedHomework={canManageSelectedHomework}
  _canWriteHomework={canWriteHomework}
  _completionSaving={completionSaving}
  _cancelEditHomework={cancelEditHomework}
  _commentsCopy={commentsCopy}
  _commonCopy={commonCopy}
  _editHomeworkMessage={editHomeworkMessage}
  bind:_editHomeworkPublishedAt={editHomeworkPublishedAt}
  bind:_editHomeworkSubmissionDueAt={editHomeworkSubmissionDueAt}
  bind:_editHomeworkSubmissionStartAt={editHomeworkSubmissionStartAt}
  _editingHomework={editingHomework}
  _fmtDateTime={fmtDateTime}
  _formatMessage={formatMessage}
  _homeworkAuditActionLabel={homeworkAuditActionLabel}
  _homeworkCopy={homeworkCopy}
  _sectionCopy={sectionCopy}
  _selectedHomework={selectedHomework}
  _semesterDate={semesterDate}
  _setDeleteHomeworkTarget={setDeleteHomeworkTarget}
  _startEditHomework={startEditHomework}
  _toggleHomeworkCompletion={toggleHomeworkCompletion}
  _updateHomework={updateHomework}
  {locale}
  {sectionLabel}
  {sectionJwId}
  close={() => {
    setSelectedHomework(null);
    cancelEditHomework();
  }}
/>

{#if isHomeworkAuditDialogOpen}
  <SectionHomeworkAuditDialog
    actionLabel={homeworkAuditActionLabel}
    actorName={homeworkAuditActorName}
    {fmtDateTime}
    {formatMessage}
    {homeworkCopy}
    logs={homeworkAuditLogs}
    {sectionCopy}
    setOpen={setHomeworkAuditDialogOpen}
  />
{/if}

{#if deleteHomeworkTarget}
  <SectionHomeworkDeleteDialog
    {formatMessage}
    {homeworkCopy}
    onCancel={() => setDeleteHomeworkTarget(null)}
    onConfirm={deleteHomework}
    target={deleteHomeworkTarget}
  />
{/if}
