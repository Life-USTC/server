<script lang="ts">
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
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
export let homeworkMessage: string;
export let homeworkStatus: SectionDetailDialogsProps["homeworkStatus"];
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

let SectionHomeworkDialogs:
  | typeof import("./SectionHomeworkDialogs.svelte").default
  | null = null;
let CalendarSubscriptionDialog:
  | typeof import("@/features/calendar/components/CalendarSubscriptionDialog.svelte").default
  | null = null;

async function ensureSectionHomeworkDialogs() {
  SectionHomeworkDialogs ??= (await import("./SectionHomeworkDialogs.svelte"))
    .default;
}

async function ensureSectionCalendarDialog() {
  CalendarSubscriptionDialog ??= (
    await import(
      "@/features/calendar/components/CalendarSubscriptionDialog.svelte"
    )
  ).default;
}

$: if (
  showCreateHomework ||
  selectedHomework ||
  deleteHomeworkTarget ||
  isHomeworkAuditDialogOpen
) {
  void ensureSectionHomeworkDialogs();
}
$: if (isCalendarDialogOpen) {
  void ensureSectionCalendarDialog();
}
</script>

{#if SectionHomeworkDialogs}
  <svelte:component
    this={SectionHomeworkDialogs}
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
  {homeworkMessage}
  {homeworkStatus}
  {isHomeworkAuditDialogOpen}
  {sectionCopy}
  sectionJwId={data.section.jwId}
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
{/if}

{#if CalendarSubscriptionDialog}
  <svelte:component
    this={CalendarSubscriptionDialog}
  {clipboardError}
  {clipboardMessage}
  close={closeCalendarDialog}
  copy={sectionCopy}
  isOpen={isCalendarDialogOpen}
  onOpenChange={setCalendarDialogOpen}
  urls={[{
    copied: copiedCalendarTarget === "single",
    description: sectionCopy.calendarUrlDescription,
    id: "calendar-url",
    label: sectionCopy.calendarUrlLabel,
    onCopy: () => copyText(singleCalendarUrl, "single"),
    value: singleCalendarUrl,
  }, {
    copied: copiedCalendarTarget === "subscription",
    description: sectionCopy.subscriptionUrlDescription,
    id: "subscription-url",
    label: sectionCopy.subscriptionUrlLabel,
    missingLabel: sectionCopy.subscriptionMissing,
    onCopy: () => copyText(subscriptionCalendarUrl, "subscription"),
    value: subscriptionCalendarUrl,
    warning: sectionCopy.subscriptionPrivacyNote,
  }]}
  />
{/if}

{#if showSubscribeDialog && data.section.retiredAt == null}
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
