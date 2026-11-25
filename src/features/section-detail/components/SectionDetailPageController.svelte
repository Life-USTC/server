<script lang="ts">
import type { ComponentProps } from "svelte";
export let content: ComponentProps<typeof SectionDetailMainContent>["content"];

import { toast } from "@ui-sdk/svelte/toast";
import { onMount } from "svelte";
import { nextHomeworkClassStarts } from "@/features/homeworks/lib/homework-due-shortcuts";
// biome-ignore assist/source/organizeImports: keep Svelte template/action imports grouped with local suppressions.
import { homeworkSemesterShortcutCapabilities } from "@/features/homeworks/lib/homework-timestamp-defaults";
import SectionDetailMainContent from "@/features/section-detail/components/SectionDetailMainContent.svelte";
import SectionDetailPageHead from "@/features/section-detail/components/SectionDetailPageHead.svelte";
import {
  loadSectionHomeworkAuditLogs,
  loadSectionHomeworkDetail,
} from "@/features/section-detail/lib/homeworks";
import { createSectionCalendarClipboardActions } from "@/features/section-detail/lib/section-detail-calendar-clipboard-actions";
import { createSectionDetailCalendarDisplayActions } from "@/features/section-detail/lib/section-detail-calendar-display-actions";
import { buildSectionDetailCalendarEvents } from "@/features/section-detail/lib/section-detail-calendar-events";
import { sectionDetailCalendarUrls } from "@/features/section-detail/lib/section-detail-calendar-urls";
import { createSectionDetailControllerDefaultState } from "@/features/section-detail/lib/section-detail-controller-default-state";
import {
  type HomeworkAuditLog,
  type SectionDetailActionData,
  type SectionDetailPageData,
  type SectionHomework,
} from "@/features/section-detail/lib/section-detail-controller-helpers";
import { mountSectionDetailController } from "@/features/section-detail/lib/section-detail-controller-mount";
import {
  buildSectionDetailCommentTargets,
  buildSectionPeriodDetailRows,
  canManageSectionHomework,
  canWriteSectionHomework,
  sectionHomeworkAuditLogs,
} from "@/features/section-detail/lib/section-detail-derived-state";
import { createSectionDetailDisplayActions } from "@/features/section-detail/lib/section-detail-display-actions";
import { createSectionDetailHomeworkActions } from "@/features/section-detail/lib/section-detail-homework-actions";
import { createSectionHomeworkTimestampActions } from "@/features/section-detail/lib/section-detail-homework-timestamp-actions";
import {
  createSectionDetailTabPanelSsrSeedFromPageData,
  createSectionDetailTabPanelStore,
} from "@/features/section-detail/lib/section-detail-tab-client";
import { createSectionDetailUiActions } from "@/features/section-detail/lib/section-detail-ui-actions";
import { fetchSectionPersonalData } from "@/features/section-detail/lib/section-personal-client";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import SectionSubscribeDialog from "./SectionSubscribeDialog.svelte";

type PageData = SectionDetailPageData;
type ActionData = SectionDetailActionData;

export let data: PageData;
export let form: ActionData;

let state = createSectionDetailControllerDefaultState(data);

function set<K extends keyof typeof state>(key: K) {
  return (value: (typeof state)[K]) => {
    state[key] = value;
  };
}

const shellViewer = getShellViewer();
let streamLoading = true;
let personalLoading = true;
let personalFailed = false;
let personalAbortController: AbortController | null = null;
let personalViewer: PageData["viewer"] = {
  signedIn: false,
  isSubscribed: false,
};
$: overlayData = {
  ...data,
  viewer: {
    ...personalViewer,
    loading: personalLoading,
    failed: personalFailed,
  },
};
async function loadPersonalData() {
  if ($shellViewer.status !== "ready") {
    personalFailed = $shellViewer.status === "error";
    personalLoading = !personalFailed;
    if (personalFailed) await shellViewer.retry();
    return;
  }
  personalAbortController?.abort();
  const controller = new AbortController();
  personalAbortController = controller;
  personalLoading = true;
  personalFailed = false;
  try {
    const result = await fetchSectionPersonalData({
      jwId: data.section.jwId,
      focusedHomeworkId: data.focusedHomeworkId ?? null,
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    personalViewer = result.viewer;
    state.homeworkViewer = result.homeworkData.viewer;
    state.homeworks = result.homeworkData.homeworks;
    state.homeworkAuditLogs = result.homeworkData.auditLogs;
    syncFocusedHomework(state.homeworks);
    scrollToFocusedHomework();
  } catch {
    if (!controller.signal.aborted) personalFailed = true;
  } finally {
    if (!controller.signal.aborted) personalLoading = false;
  }
}
let streamError: string | null = null;
const tabPanelStore = createSectionDetailTabPanelStore(
  data.homeworkData.viewer.userId ?? null,
  createSectionDetailTabPanelSsrSeedFromPageData(
    data,
    data.homeworkData.viewer.userId ?? null,
  ),
);
let tabPanelState = tabPanelStore.getState();

function overlayField<T>(overlayValue: T[], sectionValue: T[]) {
  return overlayValue.length > 0 ? overlayValue : sectionValue;
}

$: displaySection = {
  ...data.section,
  exams: overlayField(
    tabPanelState.sectionOverlay.exams,
    data.section.exams ?? [],
  ),
  schedules: overlayField(
    tabPanelState.sectionOverlay.schedules,
    data.section.schedules ?? [],
  ),
  teachers: overlayField(
    tabPanelState.sectionOverlay.teachers,
    data.section.teachers ?? [],
  ),
};
$: panelDescriptionData = tabPanelStore.isLoaded("introduction")
  ? tabPanelState.descriptionData
  : data.descriptionData;

function syncFocusedHomework(homeworks: SectionHomework[]) {
  if (data.focusedHomeworkId == null) return;
  const focused = homeworks.find(
    (homework) => homework.id === data.focusedHomeworkId,
  );
  if (focused) {
    state.selectedHomework = focused;
  }
}

let homeworkDetailRequest = 0;
let homeworkAuditRequest = 0;

async function selectHomework(homework: SectionHomework) {
  const requestId = ++homeworkDetailRequest;
  try {
    const detail = await loadSectionHomeworkDetail<
      SectionHomework,
      HomeworkAuditLog
    >(homework.id, _sectionCopy.operationFailed);
    if (requestId !== homeworkDetailRequest) return;

    const { section: _section, ...scopedHomework } = detail.homework;
    state.homeworkAuditLogs = detail.auditLogs;
    state.selectedHomework = scopedHomework;
  } catch (error) {
    if (requestId !== homeworkDetailRequest) return;
    state.homeworkMessage =
      error instanceof Error ? error.message : _sectionCopy.operationFailed;
  }
}

async function loadHomeworkAuditLogs() {
  const requestId = ++homeworkAuditRequest;
  try {
    const auditLogs = await loadSectionHomeworkAuditLogs<HomeworkAuditLog>(
      data.section.id,
      _sectionCopy.operationFailed,
    );
    if (requestId !== homeworkAuditRequest || !state.isHomeworkAuditDialogOpen)
      return;
    state.homeworkAuditLogs = auditLogs;
  } catch (error) {
    if (requestId !== homeworkAuditRequest || !state.isHomeworkAuditDialogOpen)
      return;
    state.homeworkMessage =
      error instanceof Error ? error.message : _sectionCopy.operationFailed;
  }
}

async function ensureStreamPanelsLoaded() {
  const panelInput = {
    errorMessage: _sectionCopy.operationFailed,
    jwId: Number(data.section.jwId),
    locale: data.locale,
    sectionId: Number(data.section.id),
  };
  streamLoading = true;
  streamError = null;
  try {
    const tab =
      data.detailSection === "introduction" ? "teachers" : data.detailSection;
    if (tab !== "homework" && !tabPanelStore.isLoaded(tab)) {
      tabPanelState = await tabPanelStore.ensureLoaded(tab, panelInput);
    }
    syncFocusedHomework(state.homeworks);
  } catch {
    streamError = _sectionCopy.operationFailed;
  } finally {
    streamLoading = false;
  }
}

function retryStreamPanels() {
  void loadPersonalData();
  void ensureStreamPanelsLoaded();
}

function scrollToFocusedHomework() {
  if (data.focusedHomeworkId == null) return;
  document.getElementById("homework")?.scrollIntoView({ behavior: "smooth" });
}

const {
  auditActionLabel: _homeworkAuditActionLabel,
  auditActorName: _homeworkAuditActorName,
  dateTimeInputValue: _dateTimeInputValue,
  formatMessage: _formatMessage,
  primaryName: _primaryName,
  secondaryName: _secondaryName,
  teacherName: _teacherName,
  yesNo: _yesNo,
} = createSectionDetailDisplayActions({
  getCommonCopy: () => _commonCopy,
  getHomeworkCopy: () => _homeworkCopy,
  getNotAvailable: () => _notAvailable,
  getSection: () => displaySection,
  getSectionCopy: () => _sectionCopy,
});

const { fmtDate: _fmtDate, fmtDateTime: _fmtDateTime } =
  createSectionDetailCalendarDisplayActions({
    getNotAvailable: () => _notAvailable,
    getSectionCalendarEvents: () => sectionCalendarEvents,
    locale: data.locale,
  });

$: _copy = data.copy;
$: _sectionCopy = _copy.sectionDetail;
$: _homeworkCopy = _copy.homeworks;
$: _commentsCopy = _copy.comments;
$: _commonCopy = _copy.common;
$: _notAvailable = _sectionCopy.notAvailable;
$: _courseName = _primaryName(data.section.course) || data.section.code;
$: _courseSecondaryName = _secondaryName(data.section.course);
$: _sectionHomeworkLabel = [
  _courseName,
  data.section.code,
  data.section.semester?.nameCn,
]
  .filter(Boolean)
  .join(" · ");
$: _commentTargets = buildSectionDetailCommentTargets(_copy, data.section);
$: calendarUrls = sectionDetailCalendarUrls({
  jwId: data.section.jwId,
  origin: state.origin,
});
$: singleCalendarUrl = calendarUrls.singleCalendarUrl;
$: periodDetailRows = buildSectionPeriodDetailRows(_sectionCopy, data.section);
$: _canWriteHomework = canWriteSectionHomework(state.homeworkViewer);
$: _canManageSelectedHomework = canManageSectionHomework(
  state.homeworkViewer,
  state.selectedHomework,
);
$: sectionCalendarEvents =
  data.detailSection === "schedule"
    ? buildSectionDetailCalendarEvents({
        notAvailable: _notAvailable,
        section: displaySection,
        sectionCopy: _sectionCopy,
      })
    : [];

const {
  cancelEditHomework: _cancelEditHomework,
  closeCreateHomeworkDialog: _closeCreateHomeworkDialog,
  closeSubscribeDialog: _closeSubscribeDialog,
  openCreateHomeworkDialog: _openCreateHomeworkDialog,
  openSubscribeDialog: _openSubscribeDialog,
  semesterDate: _semesterDate,
  setHomeworkView: _setHomeworkView,
  startEditHomework: _startEditHomework,
  subscriptionAction: _subscriptionAction,
} = createSectionDetailUiActions({
  getSection: () => displaySection,
  getSelectedHomework: () => state.selectedHomework,
  setCreateHomeworkPublishedAt: set("createHomeworkPublishedAt"),
  setCreateHomeworkSubmissionDueAt: set("createHomeworkSubmissionDueAt"),
  setCreateHomeworkSubmissionStartAt: set("createHomeworkSubmissionStartAt"),
  setEditHomeworkMessage: set("editHomeworkMessage"),
  setEditHomeworkPublishedAt: set("editHomeworkPublishedAt"),
  setEditHomeworkSubmissionDueAt: set("editHomeworkSubmissionDueAt"),
  setEditHomeworkSubmissionStartAt: set("editHomeworkSubmissionStartAt"),
  setEditingHomework: set("editingHomework"),
  setHomeworkMessage: set("homeworkMessage"),
  setHomeworkView: set("homeworkView"),
  setShowCreateHomework: set("showCreateHomework"),
  setShowSubscribeDialog: set("showSubscribeDialog"),
  onSuccess: (action) => {
    void loadPersonalData();
    state.showSubscribeDialog = false;
    toast.success(
      action === "subscribe"
        ? _sectionCopy.subscribeSuccess
        : _sectionCopy.unsubscribeSuccess,
    );
  },
  setSubscriptionPendingAction: set("subscriptionPendingAction"),
});

function _closeCalendarDialog() {
  state.isCalendarDialogOpen = false;
}

const createShortcuts = createSectionHomeworkTimestampActions({
  getSemesterDate: _semesterDate,
  setPublishedAt: set("createHomeworkPublishedAt"),
  setSubmissionDueAt: set("createHomeworkSubmissionDueAt"),
  setSubmissionStartAt: set("createHomeworkSubmissionStartAt"),
});
const editShortcuts = createSectionHomeworkTimestampActions({
  getSemesterDate: _semesterDate,
  setPublishedAt: set("editHomeworkPublishedAt"),
  setSubmissionDueAt: set("editHomeworkSubmissionDueAt"),
  setSubmissionStartAt: set("editHomeworkSubmissionStartAt"),
});

const {
  clearClipboardTimer: _clearClipboardTimer,
  copyText: _copyText,
  openCalendarDialog: _openCalendarDialog,
} = createSectionCalendarClipboardActions({
  getCopiedMessage: () => _sectionCopy.copied,
  getFailureMessage: () => _sectionCopy.operationFailed,
  setCalendarDialogOpen: set("isCalendarDialogOpen"),
  setClipboardError: set("clipboardError"),
  setClipboardMessage: set("clipboardMessage"),
  setCopiedCalendarTarget: set("copiedCalendarTarget"),
});

const {
  createHomework: _createHomework,
  deleteHomework: _deleteHomework,
  loadHomeworks: _loadHomeworks,
  toggleHomeworkCompletion: _toggleHomeworkCompletion,
  updateHomework: _updateHomework,
} = createSectionDetailHomeworkActions({
  cancelEditHomework: _cancelEditHomework,
  closeCreateHomeworkDialog: _closeCreateHomeworkDialog,
  getCreateHomeworkPublishedAt: () => state.createHomeworkPublishedAt,
  getCreateHomeworkSubmissionDueAt: () => state.createHomeworkSubmissionDueAt,
  getCreateHomeworkSubmissionStartAt: () =>
    state.createHomeworkSubmissionStartAt,
  getDeleteHomeworkTarget: () => state.deleteHomeworkTarget,
  getEditHomeworkPublishedAt: () => state.editHomeworkPublishedAt,
  getEditHomeworkSubmissionDueAt: () => state.editHomeworkSubmissionDueAt,
  getEditHomeworkSubmissionStartAt: () => state.editHomeworkSubmissionStartAt,
  getHomeworkCopy: () => _homeworkCopy,
  getHomeworkViewer: () => state.homeworkViewer,
  getHomeworks: () => state.homeworks,
  getSectionId: () => data.section.id,
  onSuccess: (action) => {
    const message =
      action === "create"
        ? _homeworkCopy.createSuccess
        : action === "update"
          ? _homeworkCopy.updateSuccess
          : action === "delete"
            ? _homeworkCopy.deleteSuccess
            : action === "complete"
              ? _homeworkCopy.markComplete
              : _homeworkCopy.markIncomplete;
    toast.success(message);
  },
  getSelectedHomework: () => state.selectedHomework,
  setCompletionSaving: set("completionSaving"),
  setDeleteHomeworkTarget: set("deleteHomeworkTarget"),
  setEditHomeworkMessage: set("editHomeworkMessage"),
  setHomeworkAuditLogs: set("homeworkAuditLogs"),
  setHomeworkMessage: set("homeworkMessage"),
  setHomeworkViewer: set("homeworkViewer"),
  setHomeworks: set("homeworks"),
  setSelectedHomework: set("selectedHomework"),
});

function setAuditOpen(open: boolean) {
  state.isHomeworkAuditDialogOpen = open;
  if (open) void loadHomeworkAuditLogs();
}

function _auditLogsForHomework(homeworkId: string) {
  return sectionHomeworkAuditLogs(state.homeworkAuditLogs, homeworkId);
}

onMount(() => {
  const cleanup = mountSectionDetailController({
    clearClipboardTimer: _clearClipboardTimer,
    getHomeworkView: () => state.homeworkView,
    loadHomeworks: _loadHomeworks,
    setHomeworkView: set("homeworkView"),
    setOrigin: set("origin"),
    shouldLoadHomeworks: false,
  });
  if ($shellViewer.status === "ready") void loadPersonalData();
  else {
    personalFailed = $shellViewer.status === "error";
    personalLoading = !personalFailed;
  }
  void (async () => {
    await ensureStreamPanelsLoaded();
    scrollToFocusedHomework();
  })();
  return () => {
    personalAbortController?.abort();
    homeworkDetailRequest += 1;
    homeworkAuditRequest += 1;
    cleanup();
  };
});
let homeworkDialogs: typeof import("./section-homework-dialogs") | null = null;
let CalendarSubscriptionDialog:
  | typeof import("@/features/calendar/components/CalendarSubscriptionDialog.svelte").default
  | null = null;

async function ensureSectionHomeworkDialogs() {
  homeworkDialogs ??= await import("./section-homework-dialogs");
}

async function ensureSectionCalendarDialog() {
  CalendarSubscriptionDialog ??= (
    await import(
      "@/features/calendar/components/CalendarSubscriptionDialog.svelte"
    )
  ).default;
}

$: if (
  state.showCreateHomework ||
  state.selectedHomework ||
  state.deleteHomeworkTarget ||
  state.isHomeworkAuditDialogOpen
) {
  void ensureSectionHomeworkDialogs();
}
$: if (state.isCalendarDialogOpen) {
  void ensureSectionCalendarDialog();
}
</script>

<SectionDetailPageHead
  code={data.section.code}
  courseName={_courseName}
  formatMessage={_formatMessage}
  structuredDataJson={data.demo ? "" : data.structuredDataJson}
  titleTemplate={_copy.metadata.pages.sectionDetail}
/>

<section class="flex min-h-full flex-col lg:h-full lg:min-h-0">
  <SectionDetailMainContent {content}
    canWriteHomework={!personalLoading && !personalFailed && _canWriteHomework}
    commentTargets={_commentTargets}
    commonCopy={_commonCopy}
    courseName={_courseName}
    courseSecondaryName={_courseSecondaryName}
    data={overlayData}
    descriptionData={panelDescriptionData}
    displaySection={displaySection}
    formError={form?.error}
    fmtDate={_fmtDate}
    fmtDateTime={_fmtDateTime}
    homeworkCopy={_homeworkCopy}
    homeworks={state.homeworks}
    notAvailable={_notAvailable}
    openCalendarDialog={_openCalendarDialog}
    openCreateHomeworkDialog={_openCreateHomeworkDialog}
    openHomeworkAuditDialog={() => setAuditOpen(true)}
    openSubscribeDialog={_openSubscribeDialog}
    {periodDetailRows}
    primaryName={_primaryName}
    roomMapCopy={data.copy.roomMap}
    {sectionCalendarEvents}
    sectionCopy={_sectionCopy}
    setSelectedHomework={selectHomework}
    {retryStreamPanels}
    streamError={personalFailed ? _sectionCopy.operationFailed : streamError}
    streamLoading={streamLoading || personalLoading}
    teacherName={_teacherName}
    viewer={overlayData.viewer}
    yesNo={_yesNo}
  />
</section>

{#if homeworkDialogs}
  <svelte:component
    this={homeworkDialogs.CreateHomeworkDialog}
    classSectionJwId={data.demo ? undefined : data.section.jwId}
    classStarts={nextHomeworkClassStarts(data.section.schedules ?? [])}
    locale={data.locale}
    shortcuts={createShortcuts}
    close={_closeCreateHomeworkDialog}
    commentsCopy={_commentsCopy}
    createHomework={_createHomework}
    hasSemesterEnd={state.showCreateHomework && homeworkSemesterShortcutCapabilities({ semesterEnd: _semesterDate("end") }).hasSemesterEnd}
    hasSemesterStart={state.showCreateHomework && Boolean(_semesterDate("start"))}
    homeworkCopy={_homeworkCopy}
    homeworkMessage={state.homeworkMessage}
    bind:publishedAt={state.createHomeworkPublishedAt}
    sectionLabel={_sectionHomeworkLabel}
    show={state.showCreateHomework}
    bind:submissionDueAt={state.createHomeworkSubmissionDueAt}
    bind:submissionStartAt={state.createHomeworkSubmissionStartAt}
  />

  <svelte:component
    this={homeworkDialogs.HomeworkDetailDialog}
    showPersonalStatus={!data.demo && !overlayData.viewer.loading && !overlayData.viewer.failed && overlayData.viewer.signedIn === true}
    classSectionJwId={data.demo ? undefined : data.section.jwId}
    classStarts={nextHomeworkClassStarts(data.section.schedules ?? [])}
    readOnlyReason={data.demo?.readOnlyReason}
    referenceDate={data.demo?.referenceNow}
    CommentsPanel={homeworkDialogs.CommentsPanel}
    shortcuts={editShortcuts}
    {_auditLogsForHomework}
    {_canManageSelectedHomework}
    _canWriteHomework={!personalLoading && !personalFailed && _canWriteHomework}
    _completionSaving={state.completionSaving}
    {_cancelEditHomework}
    {_commentsCopy}
    {_commonCopy}
    _editHomeworkMessage={state.editHomeworkMessage}
    bind:_editHomeworkPublishedAt={state.editHomeworkPublishedAt}
    bind:_editHomeworkSubmissionDueAt={state.editHomeworkSubmissionDueAt}
    bind:_editHomeworkSubmissionStartAt={state.editHomeworkSubmissionStartAt}
    _editingHomework={state.editingHomework}
    {_fmtDateTime}
    {_formatMessage}
    {_homeworkAuditActionLabel}
    {_homeworkCopy}
    {_sectionCopy}
    _selectedHomework={state.selectedHomework}
    {_semesterDate}
    _setDeleteHomeworkTarget={set("deleteHomeworkTarget")}
    {_startEditHomework}
    {_toggleHomeworkCompletion}
    {_updateHomework}
    locale={data.locale}
    sectionLabel={_sectionHomeworkLabel}
    sectionJwId={data.section.jwId}
    close={() => {
      state.selectedHomework = null;
      _cancelEditHomework();
    }}
  />

  {#if state.isHomeworkAuditDialogOpen}
    <svelte:component
      this={homeworkDialogs.HomeworkAuditDialog}
      actionLabel={_homeworkAuditActionLabel}
      actorName={_homeworkAuditActorName}
      fmtDateTime={_fmtDateTime}
      formatMessage={_formatMessage}
      homeworkCopy={_homeworkCopy}
      logs={state.homeworkAuditLogs}
      sectionCopy={_sectionCopy}
      setOpen={setAuditOpen}
    />
  {/if}

  {#if state.deleteHomeworkTarget}
    <svelte:component
      this={homeworkDialogs.HomeworkDeleteDialog}
      formatMessage={_formatMessage}
      homeworkCopy={_homeworkCopy}
      onCancel={() => { state.deleteHomeworkTarget = null; }}
      onConfirm={_deleteHomework}
      target={state.deleteHomeworkTarget}
    />
  {/if}
{/if}

{#if CalendarSubscriptionDialog}
  <svelte:component
    this={CalendarSubscriptionDialog}
    clipboardError={state.clipboardError}
    clipboardMessage={state.clipboardMessage}
    close={_closeCalendarDialog}
    copy={_sectionCopy}
    isOpen={state.isCalendarDialogOpen}
    onOpenChange={set("isCalendarDialogOpen")}
    personalScope={{ label: _sectionCopy.subscriptionUrlLabel, description: _sectionCopy.subscriptionUrlDescription, linkLabel: _sectionCopy.subscriptionMissing }}
    showSubscriptionsLink={false}
    urls={[{
      copied: state.copiedCalendarTarget === "single",
      description: _sectionCopy.calendarUrlDescription,
      id: "calendar-url",
      label: _sectionCopy.calendarUrlLabel,
      onCopy: () => _copyText(singleCalendarUrl, "single"),
      value: singleCalendarUrl,
    }]}
  />
{/if}

{#if state.showSubscribeDialog && !personalLoading && !personalFailed && (data.section.retiredAt == null || overlayData.viewer.isSubscribed)}
  <SectionSubscribeDialog
    close={_closeSubscribeDialog}
    courseName={_courseName}
    isSubscribed={Boolean(overlayData.viewer.isSubscribed)}
    openCalendar={() => { _closeSubscribeDialog(); state.isCalendarDialogOpen = true; }}
    commonCopy={_commonCopy}
    homeworkCopy={_homeworkCopy}
    sectionCopy={_sectionCopy}
    signedIn={overlayData.viewer.signedIn === true}
    subscriptionAction={_subscriptionAction}
    subscriptionPendingAction={state.subscriptionPendingAction}
  />
{/if}
