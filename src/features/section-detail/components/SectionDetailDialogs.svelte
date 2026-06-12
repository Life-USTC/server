<script lang="ts">
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
import SectionCalendarDialog from "./SectionCalendarDialog.svelte";
import SectionHomeworkDialogs from "./SectionHomeworkDialogs.svelte";
import SectionSubscribeDialog from "./SectionSubscribeDialog.svelte";
import type {
  BooleanSetter,
  FormatMessage,
} from "./section-detail-component-types";
import type { SectionDetailDialogsProps } from "./section-detail-dialog-types";

export let auditLogsForHomework: SectionDetailDialogsProps["auditLogsForHomework"];
export let canManageSelectedHomework: boolean;
export let canWriteHomework: boolean;
export let cancelEditHomework: SectionDetailDialogsProps["cancelEditHomework"];
export let clipboardError: string;
export let clipboardMessage: string;
export let closeCalendarDialog: SectionDetailDialogsProps["closeCalendarDialog"];
export let closeCreateHomeworkDialog: SectionDetailDialogsProps["closeCreateHomeworkDialog"];
export let closeSubscribeDialog: SectionDetailDialogsProps["closeSubscribeDialog"];
export let commentsCopy: SectionDetailDialogsProps["commentsCopy"];
export let commonCopy: SectionDetailDialogsProps["commonCopy"];
export let copiedCalendarTarget: SectionDetailDialogsProps["copiedCalendarTarget"];
export let copyText: SectionDetailDialogsProps["copyText"];
export let createHomework: SectionDetailDialogsProps["createHomework"];
export let createHomeworkPublishedAt: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let deleteHomework: SectionDetailDialogsProps["deleteHomework"];
export let deleteHomeworkTarget: SectionDetailDialogsProps["deleteHomeworkTarget"];
export let editHomeworkMessage: string;
export let editHomeworkPublishedAt: string;
export let editHomeworkSubmissionDueAt: string;
export let editHomeworkSubmissionStartAt: string;
export let editingHomework: boolean;
export let fmtDateTime: SectionDetailDialogsProps["fmtDateTime"];
export let formatMessage: FormatMessage;
export let hasSemesterEnd: boolean;
export let hasSemesterStart: boolean;
export let homeworkAuditActionLabel: SectionDetailDialogsProps["homeworkAuditActionLabel"];
export let homeworkAuditActorName: SectionDetailDialogsProps["homeworkAuditActorName"];
export let homeworkAuditLogs: SectionDetailDialogsProps["homeworkAuditLogs"];
export let homeworkCopy: SectionDetailDialogsProps["homeworkCopy"];
export let homeworkDescriptionMaxLength: number;
export let homeworkMessage: string;
export let homeworkStatus: SectionDetailDialogsProps["homeworkStatus"];
export let homeworkTitleMaxLength: number;
export let isCalendarDialogOpen: boolean;
export let isHomeworkAuditDialogOpen: boolean;
export let sectionCopy: SectionDetailDialogsProps["sectionCopy"];
export let selectedHomework: SectionDetailDialogsProps["selectedHomework"];
export let semesterDate: SectionDetailDialogsProps["semesterDate"];
export let setCalendarDialogOpen: BooleanSetter;
export let setDeleteHomeworkTarget: SectionDetailDialogsProps["setDeleteHomeworkTarget"];
export let setHomeworkAuditDialogOpen: BooleanSetter;
export let setSelectedHomework: SectionDetailDialogsProps["setSelectedHomework"];
export let showCreateHomework: boolean;
export let showSubscribeDialog: boolean;
export let singleCalendarUrl: string;
export let startEditHomework: SectionDetailDialogsProps["startEditHomework"];
export let subscriptionAction: SectionDetailDialogsProps["subscriptionAction"];
export let subscriptionCalendarUrl: string;
export let subscriptionPendingAction: SectionDetailDialogsProps["subscriptionPendingAction"];
export let updateHomework: SectionDetailDialogsProps["updateHomework"];
export let toggleHomeworkCompletion: SectionDetailDialogsProps["toggleHomeworkCompletion"];
export let data: SectionDetailPageData;
export let applyCreateDueAtSemesterEnd: SectionDetailDialogsProps["applyCreateDueAtSemesterEnd"];
export let applyCreateDueInMonth: SectionDetailDialogsProps["applyCreateDueInMonth"];
export let applyCreateDueInWeek: SectionDetailDialogsProps["applyCreateDueInWeek"];
export let applyCreatePublishNow: SectionDetailDialogsProps["applyCreatePublishNow"];
export let applyCreateStartAtSemesterStart: SectionDetailDialogsProps["applyCreateStartAtSemesterStart"];
export let applyCreateStartNow: SectionDetailDialogsProps["applyCreateStartNow"];
export let applyEditDueAtSemesterEnd: SectionDetailDialogsProps["applyEditDueAtSemesterEnd"];
export let applyEditDueInMonth: SectionDetailDialogsProps["applyEditDueInMonth"];
export let applyEditDueInWeek: SectionDetailDialogsProps["applyEditDueInWeek"];
export let applyEditPublishNow: SectionDetailDialogsProps["applyEditPublishNow"];
export let applyEditStartAtSemesterStart: SectionDetailDialogsProps["applyEditStartAtSemesterStart"];
export let applyEditStartNow: SectionDetailDialogsProps["applyEditStartNow"];
</script>

<SectionHomeworkDialogs
  {applyCreateDueAtSemesterEnd}
  {applyCreateDueInMonth}
  {applyCreateDueInWeek}
  {applyCreatePublishNow}
  {applyCreateStartAtSemesterStart}
  {applyCreateStartNow}
  {applyEditDueAtSemesterEnd}
  {applyEditDueInMonth}
  {applyEditDueInWeek}
  {applyEditPublishNow}
  {applyEditStartAtSemesterStart}
  {applyEditStartNow}
  {auditLogsForHomework}
  {canManageSelectedHomework}
  {canWriteHomework}
  {cancelEditHomework}
  {closeCreateHomeworkDialog}
  {commentsCopy}
  {commonCopy}
  {createHomework}
  bind:createHomeworkPublishedAt
  bind:createHomeworkSubmissionDueAt
  bind:createHomeworkSubmissionStartAt
  {deleteHomework}
  {deleteHomeworkTarget}
  {editHomeworkMessage}
  bind:editHomeworkPublishedAt
  bind:editHomeworkSubmissionDueAt
  bind:editHomeworkSubmissionStartAt
  {editingHomework}
  {fmtDateTime}
  {formatMessage}
  {hasSemesterEnd}
  {hasSemesterStart}
  {homeworkAuditActionLabel}
  {homeworkAuditActorName}
  {homeworkAuditLogs}
  {homeworkCopy}
  {homeworkDescriptionMaxLength}
  {homeworkMessage}
  {homeworkStatus}
  {homeworkTitleMaxLength}
  {isHomeworkAuditDialogOpen}
  {sectionCopy}
  {selectedHomework}
  {semesterDate}
  {setDeleteHomeworkTarget}
  {setHomeworkAuditDialogOpen}
  {setSelectedHomework}
  {showCreateHomework}
  {startEditHomework}
  {toggleHomeworkCompletion}
  {updateHomework}
/>

<SectionCalendarDialog
  {clipboardError}
  {clipboardMessage}
  close={closeCalendarDialog}
  {copiedCalendarTarget}
  {copyText}
  isOpen={isCalendarDialogOpen}
  {sectionCopy}
  setOpen={setCalendarDialogOpen}
  {singleCalendarUrl}
  {subscriptionCalendarUrl}
/>

{#if showSubscribeDialog}
  <SectionSubscribeDialog
    close={closeSubscribeDialog}
    {commonCopy}
    {homeworkCopy}
    {sectionCopy}
    sectionJwId={data.section.jwId}
    signedIn={data.viewer.signedIn === true}
    {subscriptionAction}
    {subscriptionPendingAction}
  />
{/if}
