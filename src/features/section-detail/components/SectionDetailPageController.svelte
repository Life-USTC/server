<script lang="ts">
// biome-ignore assist/source/organizeImports: keep Svelte template/action imports grouped with local suppressions.
import { onMount } from "svelte";
import { createSectionDetailDisplayActions } from "@/features/section-detail/lib/section-detail-display-actions";
import {
  buildSectionCalendarGridWeeks,
  calendarMonthOffsetForDateKey,
  findCalendarBaseMonth,
} from "@/features/section-detail/lib/calendar";
import { buildSectionDetailCalendarEvents } from "@/features/section-detail/lib/section-detail-calendar-events";
import { createSectionDetailCalendarDisplayActions } from "@/features/section-detail/lib/section-detail-calendar-display-actions";
import { createSectionCalendarClipboardActions } from "@/features/section-detail/lib/section-detail-calendar-clipboard-actions";
import { sectionDetailCalendarUrls } from "@/features/section-detail/lib/section-detail-calendar-urls";
import { mountSectionDetailController } from "@/features/section-detail/lib/section-detail-controller-mount";
import {
  createSectionDetailTabPanelStore,
  createSectionDetailTabPanelSsrSeedFromPageData,
} from "@/features/section-detail/lib/section-detail-tab-client";
import type { SectionDetailTab } from "@/features/section-detail/lib/section-detail-tab";
import {
  buildSectionDetailCommentTargets,
  buildSectionPeriodDetailRows,
  canManageSectionHomework,
  canWriteSectionHomework,
  sectionHomeworkAuditLogs,
} from "@/features/section-detail/lib/section-detail-derived-state";
import { createSectionDetailHomeworkActions } from "@/features/section-detail/lib/section-detail-homework-actions";
import { createSectionHomeworkTimestampActions } from "@/features/section-detail/lib/section-detail-homework-timestamp-actions";
import { createSectionDetailUiActions } from "@/features/section-detail/lib/section-detail-ui-actions";
import { createSectionDetailControllerDefaultState } from "@/features/section-detail/lib/section-detail-controller-default-state";
import {
  type SectionDetailActionData,
  type SectionDetailPageData,
  type SectionHomework,
} from "@/features/section-detail/lib/section-detail-controller-helpers";
import SectionDetailDialogs from "@/features/section-detail/components/SectionDetailDialogs.svelte";
import SectionDetailMainContent from "@/features/section-detail/components/SectionDetailMainContent.svelte";
import SectionDetailPageHead from "@/features/section-detail/components/SectionDetailPageHead.svelte";
type PageData = SectionDetailPageData;
type ActionData = SectionDetailActionData;

const STREAM_PANEL_TABS = [
  "introduction",
  "calendar",
  "exams",
  "homework",
  "teachers",
] as const satisfies readonly SectionDetailTab[];

export let data: PageData;
export let form: ActionData;

let {
  _calendarMonthOffset,
  _clipboardError,
  _clipboardMessage,
  _copiedCalendarTarget,
  _createHomeworkPublishedAt,
  _createHomeworkSubmissionDueAt,
  _createHomeworkSubmissionStartAt,
  _deleteHomeworkTarget,
  _editHomeworkMessage,
  _editHomeworkPublishedAt,
  _editHomeworkSubmissionDueAt,
  _editHomeworkSubmissionStartAt,
  _editingHomework,
  _homeworkAuditLogs,
  _homeworkMessage,
  _homeworkView,
  _homeworkViewer,
  _homeworks,
  _isCalendarDialogOpen,
  _isHomeworkAuditDialogOpen,
  _origin,
  _selectedHomework,
  _showCreateHomework,
  _showSubscribeDialog,
  _subscriptionPendingAction,
} = createSectionDetailControllerDefaultState(data);

let streamLoading = false;
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
    _selectedHomework = focused;
  }
}

function applyHomeworkPanelState() {
  _homeworkViewer = tabPanelState.homeworkViewer;
  _homeworks = tabPanelState.homeworks;
  _homeworkAuditLogs = tabPanelState.homeworkAuditLogs;
  syncFocusedHomework(tabPanelState.homeworks);
}

async function ensureStreamPanelsLoaded() {
  const panelInput = {
    errorMessage: _sectionCopy.operationFailed,
    jwId: Number(data.section.jwId),
    locale: data.locale,
    sectionId: Number(data.section.id),
  };
  streamLoading = true;
  try {
    for (const tab of STREAM_PANEL_TABS) {
      if (tabPanelStore.isLoaded(tab)) continue;
      tabPanelState = await tabPanelStore.ensureLoaded(tab, panelInput);
      if (tab === "homework") {
        applyHomeworkPanelState();
      }
    }
    syncFocusedHomework(_homeworks);
  } finally {
    streamLoading = false;
  }
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
  sectionTeachersLabel: _sectionTeachersLabel,
  semesterWeekLabel: _semesterWeekLabel,
  teacherName: _teacherName,
  yesNo: _yesNo,
} = createSectionDetailDisplayActions({
  getCommonCopy: () => _commonCopy,
  getHomeworkCopy: () => _homeworkCopy,
  getNotAvailable: () => _notAvailable,
  getSection: () => displaySection,
  getSectionCopy: () => _sectionCopy,
});

const {
  addMonths: _addMonths,
  calendarEventsForDay: _calendarEventsForDay,
  calendarMonthDays: _calendarMonthDays,
  calendarWeeks: _calendarWeeks,
  dateKey: _dateKey,
  fmtDate: _fmtDate,
  fmtDateTime: _fmtDateTime,
  fmtMonth: _fmtMonth,
} = createSectionDetailCalendarDisplayActions({
  getNotAvailable: () => _notAvailable,
  getSectionCalendarEvents: () => sectionCalendarEvents,
});

$: _copy = data.copy;
$: _sectionCopy = _copy.sectionDetail;
$: _homeworkCopy = _copy.homeworks;
$: _commentsCopy = _copy.comments;
$: _commonCopy = _copy.common;
$: _notAvailable = _sectionCopy.notAvailable;
$: _courseName = _primaryName(data.section.course) || data.section.code;
$: _courseSecondaryName = _secondaryName(data.section.course);
$: _commentTargets = buildSectionDetailCommentTargets(_copy, data.section);
$: calendarUrls = sectionDetailCalendarUrls({
  jwId: data.section.jwId,
  origin: _origin,
});
$: singleCalendarUrl = calendarUrls.singleCalendarUrl;
$: subscriptionCalendarUrl = "";
$: periodDetailRows = buildSectionPeriodDetailRows(_sectionCopy, data.section);
$: _canWriteHomework = canWriteSectionHomework(_homeworkViewer);
$: _canManageSelectedHomework = canManageSectionHomework(
  _homeworkViewer,
  _selectedHomework,
);
$: sectionCalendarEvents = buildSectionDetailCalendarEvents({
  notAvailable: _notAvailable,
  section: displaySection,
  sectionCopy: _sectionCopy,
});
$: todayCalendarKey = data.todayCalendarKey;
$: calendarBaseMonth = findCalendarBaseMonth(
  sectionCalendarEvents,
  todayCalendarKey,
);
$: visibleCalendarMonth = _addMonths(calendarBaseMonth, _calendarMonthOffset);
$: todayCalendarMonthOffset = calendarMonthOffsetForDateKey(
  calendarBaseMonth,
  todayCalendarKey,
);
$: calendarMonthDays = _calendarMonthDays(visibleCalendarMonth);
$: calendarMonthWeeks = _calendarWeeks(calendarMonthDays);
$: calendarMonthLabel = _fmtMonth(visibleCalendarMonth);
$: sectionCalendarGridWeeks = buildSectionCalendarGridWeeks({
  dateKey: _dateKey,
  events: sectionCalendarEvents,
  formatDate: _fmtDate,
  monthWeeks: calendarMonthWeeks,
  semesterWeekLabel: _semesterWeekLabel,
  todayKey: todayCalendarKey,
  visibleMonth: visibleCalendarMonth,
});
$: unscheduledCalendarEvents = sectionCalendarEvents.filter(
  (event) => !event.dateKey,
);

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
  getSelectedHomework: () => _selectedHomework,
  setCreateHomeworkPublishedAt: (value) => {
    _createHomeworkPublishedAt = value;
  },
  setCreateHomeworkSubmissionDueAt: (value) => {
    _createHomeworkSubmissionDueAt = value;
  },
  setCreateHomeworkSubmissionStartAt: (value) => {
    _createHomeworkSubmissionStartAt = value;
  },
  setEditHomeworkMessage: (value) => {
    _editHomeworkMessage = value;
  },
  setEditHomeworkPublishedAt: (value) => {
    _editHomeworkPublishedAt = value;
  },
  setEditHomeworkSubmissionDueAt: (value) => {
    _editHomeworkSubmissionDueAt = value;
  },
  setEditHomeworkSubmissionStartAt: (value) => {
    _editHomeworkSubmissionStartAt = value;
  },
  setEditingHomework: (value) => {
    _editingHomework = value;
  },
  setHomeworkMessage: (value) => {
    _homeworkMessage = value;
  },
  setHomeworkView: (value) => {
    _homeworkView = value;
  },
  setShowCreateHomework: (value) => {
    _showCreateHomework = value;
  },
  setShowSubscribeDialog: (value) => {
    _showSubscribeDialog = value;
  },
  setSubscriptionPendingAction: (value) => {
    _subscriptionPendingAction = value;
  },
});

function _closeCalendarDialog() {
  _isCalendarDialogOpen = false;
}

const {
  applyCreateDueAtSemesterEnd: _applyCreateDueAtSemesterEnd,
  applyCreateDueInMonth: _applyCreateDueInMonth,
  applyCreateDueInWeek: _applyCreateDueInWeek,
  applyCreatePublishNow: _applyCreatePublishNow,
  applyCreateStartAtSemesterStart: _applyCreateStartAtSemesterStart,
  applyCreateStartNow: _applyCreateStartNow,
  applyEditDueAtSemesterEnd: _applyEditDueAtSemesterEnd,
  applyEditDueInMonth: _applyEditDueInMonth,
  applyEditDueInWeek: _applyEditDueInWeek,
  applyEditPublishNow: _applyEditPublishNow,
  applyEditStartAtSemesterStart: _applyEditStartAtSemesterStart,
  applyEditStartNow: _applyEditStartNow,
} = createSectionHomeworkTimestampActions({
  getSemesterDate: _semesterDate,
  setCreatePublishedAt: (value) => {
    _createHomeworkPublishedAt = value;
  },
  setCreateSubmissionDueAt: (value) => {
    _createHomeworkSubmissionDueAt = value;
  },
  setCreateSubmissionStartAt: (value) => {
    _createHomeworkSubmissionStartAt = value;
  },
  setEditPublishedAt: (value) => {
    _editHomeworkPublishedAt = value;
  },
  setEditSubmissionDueAt: (value) => {
    _editHomeworkSubmissionDueAt = value;
  },
  setEditSubmissionStartAt: (value) => {
    _editHomeworkSubmissionStartAt = value;
  },
});

const {
  clearClipboardTimer: _clearClipboardTimer,
  copyText: _copyText,
  openCalendarDialog: _openCalendarDialog,
} = createSectionCalendarClipboardActions({
  getCopiedMessage: () => _sectionCopy.copied,
  getFailureMessage: () => _sectionCopy.operationFailed,
  setCalendarDialogOpen: (value) => {
    _isCalendarDialogOpen = value;
  },
  setClipboardError: (value) => {
    _clipboardError = value;
  },
  setClipboardMessage: (value) => {
    _clipboardMessage = value;
  },
  setCopiedCalendarTarget: (value) => {
    _copiedCalendarTarget = value;
  },
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
  getCreateHomeworkPublishedAt: () => _createHomeworkPublishedAt,
  getCreateHomeworkSubmissionDueAt: () => _createHomeworkSubmissionDueAt,
  getCreateHomeworkSubmissionStartAt: () => _createHomeworkSubmissionStartAt,
  getDeleteHomeworkTarget: () => _deleteHomeworkTarget,
  getEditHomeworkPublishedAt: () => _editHomeworkPublishedAt,
  getEditHomeworkSubmissionDueAt: () => _editHomeworkSubmissionDueAt,
  getEditHomeworkSubmissionStartAt: () => _editHomeworkSubmissionStartAt,
  getHomeworkCopy: () => _homeworkCopy,
  getHomeworkViewer: () => _homeworkViewer,
  getHomeworks: () => _homeworks,
  getSectionId: () => data.section.id,
  getSelectedHomework: () => _selectedHomework,
  setDeleteHomeworkTarget: (value) => {
    _deleteHomeworkTarget = value;
  },
  setEditHomeworkMessage: (value) => {
    _editHomeworkMessage = value;
  },
  setHomeworkAuditLogs: (value) => {
    _homeworkAuditLogs = value;
  },
  setHomeworkMessage: (value) => {
    _homeworkMessage = value;
  },
  setHomeworkViewer: (value) => {
    _homeworkViewer = value;
  },
  setHomeworks: (value) => {
    _homeworks = value;
  },
  setSelectedHomework: (value) => {
    _selectedHomework = value;
  },
});

function _auditLogsForHomework(homeworkId: string) {
  return sectionHomeworkAuditLogs(_homeworkAuditLogs, homeworkId);
}

onMount(() => {
  const cleanup = mountSectionDetailController({
    clearClipboardTimer: _clearClipboardTimer,
    getHomeworkView: () => _homeworkView,
    loadHomeworks: _loadHomeworks,
    setHomeworkView: (view) => {
      _homeworkView = view;
    },
    setOrigin: (origin) => {
      _origin = origin;
    },
    shouldLoadHomeworks: false,
  });
  void (async () => {
    await ensureStreamPanelsLoaded();
    scrollToFocusedHomework();
  })();
  return cleanup;
});
</script>

<SectionDetailPageHead
  code={data.section.code}
  courseName={_courseName}
  formatMessage={_formatMessage}
  structuredDataJson={data.structuredDataJson}
  titleTemplate={_copy.metadata.pages.sectionDetail}
/>

<section class="min-h-full lg:h-full lg:min-h-0">
  <SectionDetailMainContent
    {calendarMonthLabel}
    bind:calendarMonthOffset={_calendarMonthOffset}
    canWriteHomework={_canWriteHomework}
    commentTargets={_commentTargets}
    commonCopy={_commonCopy}
    courseName={_courseName}
    courseSecondaryName={_courseSecondaryName}
    {data}
    descriptionData={panelDescriptionData}
    displaySection={displaySection}
    formError={form?.error}
    fmtDate={_fmtDate}
    fmtDateTime={_fmtDateTime}
    formatMessage={_formatMessage}
    homeworkCopy={_homeworkCopy}
    homeworks={_homeworks}
    notAvailable={_notAvailable}
    openCalendarDialog={_openCalendarDialog}
    openCreateHomeworkDialog={_openCreateHomeworkDialog}
    openSubscribeDialog={_openSubscribeDialog}
    {periodDetailRows}
    primaryName={_primaryName}
    {sectionCalendarEvents}
    {sectionCalendarGridWeeks}
    sectionCopy={_sectionCopy}
    sectionTeachersLabel={_sectionTeachersLabel}
    setSelectedHomework={(homework) => {
      _selectedHomework = homework;
    }}
    {streamLoading}
    subscriptionAction={_subscriptionAction}
    subscriptionPendingAction={_subscriptionPendingAction}
    teacherName={_teacherName}
    {todayCalendarMonthOffset}
    {unscheduledCalendarEvents}
    viewer={data.viewer}
    yesNo={_yesNo}
  />
</section>

<SectionDetailDialogs
  applyCreateDueAtSemesterEnd={_applyCreateDueAtSemesterEnd}
  applyCreateDueInMonth={_applyCreateDueInMonth}
  applyCreateDueInWeek={_applyCreateDueInWeek}
  applyCreatePublishNow={_applyCreatePublishNow}
  applyCreateStartAtSemesterStart={_applyCreateStartAtSemesterStart}
  applyCreateStartNow={_applyCreateStartNow}
  applyEditDueAtSemesterEnd={_applyEditDueAtSemesterEnd}
  applyEditDueInMonth={_applyEditDueInMonth}
  applyEditDueInWeek={_applyEditDueInWeek}
  applyEditPublishNow={_applyEditPublishNow}
  applyEditStartAtSemesterStart={_applyEditStartAtSemesterStart}
  applyEditStartNow={_applyEditStartNow}
  auditLogsForHomework={_auditLogsForHomework}
  canManageSelectedHomework={_canManageSelectedHomework}
  canWriteHomework={_canWriteHomework}
  cancelEditHomework={_cancelEditHomework}
  clipboardError={_clipboardError}
  clipboardMessage={_clipboardMessage}
  closeCalendarDialog={_closeCalendarDialog}
  closeCreateHomeworkDialog={_closeCreateHomeworkDialog}
  closeSubscribeDialog={_closeSubscribeDialog}
  commentsCopy={_commentsCopy}
  commonCopy={_commonCopy}
  copiedCalendarTarget={_copiedCalendarTarget}
  copyText={_copyText}
  createHomework={_createHomework}
  bind:createHomeworkPublishedAt={_createHomeworkPublishedAt}
  bind:createHomeworkSubmissionDueAt={_createHomeworkSubmissionDueAt}
  bind:createHomeworkSubmissionStartAt={_createHomeworkSubmissionStartAt}
  {data}
  deleteHomework={_deleteHomework}
  deleteHomeworkTarget={_deleteHomeworkTarget}
  editHomeworkMessage={_editHomeworkMessage}
  bind:editHomeworkPublishedAt={_editHomeworkPublishedAt}
  bind:editHomeworkSubmissionDueAt={_editHomeworkSubmissionDueAt}
  bind:editHomeworkSubmissionStartAt={_editHomeworkSubmissionStartAt}
  editingHomework={_editingHomework}
  fmtDateTime={_fmtDateTime}
  formatMessage={_formatMessage}
  hasSemesterEnd={Boolean(_semesterDate("end"))}
  hasSemesterStart={Boolean(_semesterDate("start"))}
  homeworkAuditActionLabel={_homeworkAuditActionLabel}
  homeworkAuditActorName={_homeworkAuditActorName}
  homeworkAuditLogs={_homeworkAuditLogs}
  homeworkCopy={_homeworkCopy}
  homeworkMessage={_homeworkMessage}
  isCalendarDialogOpen={_isCalendarDialogOpen}
  isHomeworkAuditDialogOpen={_isHomeworkAuditDialogOpen}
  sectionCopy={_sectionCopy}
  selectedHomework={_selectedHomework}
  semesterDate={_semesterDate}
  setCalendarDialogOpen={(open) => {
    _isCalendarDialogOpen = open;
  }}
  setDeleteHomeworkTarget={(homework) => {
    _deleteHomeworkTarget = homework;
  }}
  setHomeworkAuditDialogOpen={(open) => {
    _isHomeworkAuditDialogOpen = open;
  }}
  setSelectedHomework={(homework) => {
    _selectedHomework = homework;
  }}
  showCreateHomework={_showCreateHomework}
  showSubscribeDialog={_showSubscribeDialog}
  {singleCalendarUrl}
  startEditHomework={_startEditHomework}
  subscriptionAction={_subscriptionAction}
  {subscriptionCalendarUrl}
  subscriptionPendingAction={_subscriptionPendingAction}
  toggleHomeworkCompletion={_toggleHomeworkCompletion}
  updateHomework={_updateHomework}
/>
