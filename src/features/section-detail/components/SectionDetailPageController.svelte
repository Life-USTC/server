<script lang="ts">
// biome-ignore assist/source/organizeImports: keep Svelte template/action imports grouped with local suppressions.
import { onMount } from "svelte";
import { createSectionDetailDisplayActions } from "@/features/section-detail/lib/section-detail-display-actions";
import { findCalendarBaseMonth } from "@/features/section-detail/lib/calendar";
import { buildSectionDetailCalendarEvents } from "@/features/section-detail/lib/section-detail-calendar-events";
import { createSectionDetailCalendarDisplayActions } from "@/features/section-detail/lib/section-detail-calendar-display-actions";
import { createSectionCalendarClipboardActions } from "@/features/section-detail/lib/section-detail-calendar-clipboard-actions";
import { sectionDetailCalendarUrls } from "@/features/section-detail/lib/section-detail-calendar-urls";
import { mountSectionDetailController } from "@/features/section-detail/lib/section-detail-controller-mount";
import {
  buildCalendarDateKeySet,
  buildSectionDetailCommentTargets,
  buildSectionDetailTabs,
  buildSectionPeriodDetailRows,
  canManageSectionHomework,
  canWriteSectionHomework,
  sectionHomeworkAuditLogs,
  sectionHomeworkStatus,
} from "@/features/section-detail/lib/section-detail-derived-state";
import { createSectionDetailHomeworkActions } from "@/features/section-detail/lib/section-detail-homework-actions";
import { createSectionHomeworkTimestampActions } from "@/features/section-detail/lib/section-detail-homework-timestamp-actions";
import { createSectionDetailUiActions } from "@/features/section-detail/lib/section-detail-ui-actions";
import { createSectionDetailControllerDefaultState } from "@/features/section-detail/lib/section-detail-controller-default-state";
import {
  HOMEWORK_DESCRIPTION_MAX_LENGTH,
  HOMEWORK_TITLE_MAX_LENGTH,
  type SectionDetailActionData,
  type SectionDetailPageData,
  type SectionHomework,
} from "@/features/section-detail/lib/section-detail-controller-helpers";
import SectionDetailPageContent from "@/features/section-detail/components/SectionDetailPageContent.svelte";
import SectionDetailPageHead from "@/features/section-detail/components/SectionDetailPageHead.svelte";
type PageData = SectionDetailPageData;
type ActionData = SectionDetailActionData;

export let data: PageData;
export let form: ActionData;

let {
  _activeTab,
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
  getSection: () => data.section,
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
  isSameMonth: _isSameMonth,
  sectionCalendarGridWeeks: _sectionCalendarGridWeeks,
} = createSectionDetailCalendarDisplayActions({
  getCalendarMonthWeeks: () => calendarMonthWeeks,
  getNotAvailable: () => _notAvailable,
  getSectionCalendarEvents: () => sectionCalendarEvents,
  getSemesterWeekLabel: _semesterWeekLabel,
  getTodayCalendarKey: () => todayCalendarKey,
  getVisibleCalendarMonth: () => visibleCalendarMonth,
});

$: _copy = data.copy;
$: _sectionCopy = _copy.sectionDetail;
$: _homeworkCopy = _copy.homeworks;
$: _commentsCopy = _copy.comments;
$: _commonCopy = _copy.common;
$: _notAvailable = _sectionCopy.notAvailable;
$: _courseName = _primaryName(data.section.course) || data.section.code;
$: _courseSecondaryName = _secondaryName(data.section.course);
$: _tabs = buildSectionDetailTabs(_sectionCopy);
$: _commentTargets = buildSectionDetailCommentTargets(_copy, data.section);
$: calendarUrls = sectionDetailCalendarUrls({
  jwId: data.section.jwId,
  origin: _origin,
  subscriptionPath: data.viewer.subscriptionIcsUrl ?? "",
});
$: singleCalendarUrl = calendarUrls.singleCalendarUrl;
$: subscriptionCalendarUrl = calendarUrls.subscriptionCalendarUrl;
$: periodDetailRows = buildSectionPeriodDetailRows(_sectionCopy, data.section);
$: _canWriteHomework = canWriteSectionHomework(_homeworkViewer);
$: _canManageSelectedHomework = canManageSectionHomework(
  _homeworkViewer,
  _selectedHomework,
);
$: sectionCalendarEvents = buildSectionDetailCalendarEvents({
  notAvailable: _notAvailable,
  section: data.section,
  sectionCopy: _sectionCopy,
});
$: calendarBaseMonth = findCalendarBaseMonth(sectionCalendarEvents);
$: visibleCalendarMonth = _addMonths(calendarBaseMonth, _calendarMonthOffset);
$: calendarMonthDays = _calendarMonthDays(visibleCalendarMonth);
$: calendarMonthWeeks = _calendarWeeks(calendarMonthDays);
$: calendarMonthLabel = visibleCalendarMonth.toLocaleDateString(undefined, {
  month: "long",
  year: "numeric",
});
$: unscheduledCalendarEvents = sectionCalendarEvents.filter(
  (event) => !event.dateKey,
);
$: calendarScheduleDateKeys = buildCalendarDateKeySet(
  data.section.schedules,
  (schedule) => schedule.date,
  _dateKey,
);
$: calendarExamDateKeys = buildCalendarDateKeySet(
  data.section.exams,
  (exam) => exam.examDate,
  _dateKey,
);
$: todayCalendarKey = _dateKey(new Date());

const {
  cancelEditHomework: _cancelEditHomework,
  closeCreateHomeworkDialog: _closeCreateHomeworkDialog,
  closeSubscribeDialog: _closeSubscribeDialog,
  openCreateHomeworkDialog: _openCreateHomeworkDialog,
  openSubscribeDialog: _openSubscribeDialog,
  semesterDate: _semesterDate,
  setActiveTab: _setActiveTab,
  setHomeworkView: _setHomeworkView,
  startEditHomework: _startEditHomework,
  subscriptionAction: _subscriptionAction,
} = createSectionDetailUiActions({
  getSection: () => data.section,
  getSelectedHomework: () => _selectedHomework,
  setActiveTab: (value) => {
    _activeTab = value;
  },
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

function _homeworkStatus(homework: SectionHomework) {
  return sectionHomeworkStatus(homework, _homeworkCopy);
}

function _auditLogsForHomework(homeworkId: string) {
  return sectionHomeworkAuditLogs(_homeworkAuditLogs, homeworkId);
}

onMount(() => {
  return mountSectionDetailController({
    clearClipboardTimer: _clearClipboardTimer,
    getHomeworkView: () => _homeworkView,
    loadHomeworks: _loadHomeworks,
    setActiveTab: (tab) => {
      _setActiveTab(tab, { syncHash: false });
    },
    setHomeworkView: (view) => {
      _homeworkView = view;
    },
    setOrigin: (origin) => {
      _origin = origin;
    },
  });
});
</script>

<SectionDetailPageHead
  code={data.section.code}
  courseName={_courseName}
  formatMessage={_formatMessage}
  titleTemplate={_copy.metadata.pages.sectionDetail}
/>

<SectionDetailPageContent
  activeTab={_activeTab}
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
  bind:calendarMonthOffset={_calendarMonthOffset}
  {calendarExamDateKeys}
  {calendarMonthDays}
  {calendarMonthLabel}
  {calendarScheduleDateKeys}
  canManageSelectedHomework={_canManageSelectedHomework}
  canWriteHomework={_canWriteHomework}
  cancelEditHomework={_cancelEditHomework}
  clipboardError={_clipboardError}
  clipboardMessage={_clipboardMessage}
  closeCalendarDialog={_closeCalendarDialog}
  closeCreateHomeworkDialog={_closeCreateHomeworkDialog}
  closeSubscribeDialog={_closeSubscribeDialog}
  commentTargets={_commentTargets}
  commentsCopy={_commentsCopy}
  commonCopy={_commonCopy}
  copiedCalendarTarget={_copiedCalendarTarget}
  copyText={_copyText}
  courseName={_courseName}
  courseSecondaryName={_courseSecondaryName}
  createHomework={_createHomework}
  bind:createHomeworkPublishedAt={_createHomeworkPublishedAt}
  bind:createHomeworkSubmissionDueAt={_createHomeworkSubmissionDueAt}
  bind:createHomeworkSubmissionStartAt={_createHomeworkSubmissionStartAt}
  dateKey={_dateKey}
  {data}
  deleteHomework={_deleteHomework}
  deleteHomeworkTarget={_deleteHomeworkTarget}
  bind:editHomeworkPublishedAt={_editHomeworkPublishedAt}
  bind:editHomeworkSubmissionDueAt={_editHomeworkSubmissionDueAt}
  bind:editHomeworkSubmissionStartAt={_editHomeworkSubmissionStartAt}
  editHomeworkMessage={_editHomeworkMessage}
  editingHomework={_editingHomework}
  fmtDate={_fmtDate}
  fmtDateTime={_fmtDateTime}
  {form}
  formatMessage={_formatMessage}
  hasSemesterEnd={Boolean(_semesterDate("end"))}
  hasSemesterStart={Boolean(_semesterDate("start"))}
  homeworkAuditActionLabel={_homeworkAuditActionLabel}
  homeworkAuditActorName={_homeworkAuditActorName}
  homeworkAuditLogs={_homeworkAuditLogs}
  homeworkCopy={_homeworkCopy}
  homeworkDescriptionMaxLength={HOMEWORK_DESCRIPTION_MAX_LENGTH}
  homeworkMessage={_homeworkMessage}
  homeworkStatus={_homeworkStatus}
  homeworkTitleMaxLength={HOMEWORK_TITLE_MAX_LENGTH}
  homeworkView={_homeworkView}
  homeworks={_homeworks}
  isCalendarDialogOpen={_isCalendarDialogOpen}
  isHomeworkAuditDialogOpen={_isHomeworkAuditDialogOpen}
  isSameMonth={_isSameMonth}
  notAvailable={_notAvailable}
  openCalendarDialog={_openCalendarDialog}
  openCreateHomeworkDialog={_openCreateHomeworkDialog}
  openSubscribeDialog={_openSubscribeDialog}
  {periodDetailRows}
  primaryName={_primaryName}
  {sectionCalendarEvents}
  sectionCalendarGridWeeks={_sectionCalendarGridWeeks}
  sectionCopy={_sectionCopy}
  sectionTeachersLabel={_sectionTeachersLabel}
  selectedHomework={_selectedHomework}
  semesterDate={_semesterDate}
  setActiveTab={_setActiveTab}
  setCalendarDialogOpen={(open) => {
    _isCalendarDialogOpen = open;
  }}
  setDeleteHomeworkTarget={(homework) => {
    _deleteHomeworkTarget = homework;
  }}
  setHomeworkAuditDialogOpen={(open) => {
    _isHomeworkAuditDialogOpen = open;
  }}
  setHomeworkView={_setHomeworkView}
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
  tabs={_tabs}
  teacherName={_teacherName}
  {todayCalendarKey}
  toggleHomeworkCompletion={_toggleHomeworkCompletion}
  {unscheduledCalendarEvents}
  updateHomework={_updateHomework}
  viewer={data.viewer}
  {visibleCalendarMonth}
  yesNo={_yesNo}
/>
