<script lang="ts">
import type { SectionDetailPageData } from "@/features/section-detail/lib/section-detail-controller-helpers";
import SectionDetailDialogs from "./SectionDetailDialogs.svelte";
import SectionDetailHeader from "./SectionDetailHeader.svelte";
import SectionDetailMainContent from "./SectionDetailMainContent.svelte";
import type {
  BooleanSetter,
  FormatMessage,
  IsSameMonth,
} from "./section-detail-component-types";
import type { SectionDetailPageContentProps } from "./section-detail-dialog-types";

export let activeTab: SectionDetailPageContentProps["activeTab"];
export let auditLogsForHomework: SectionDetailPageContentProps["auditLogsForHomework"];
export let calendarExamDateKeys: SectionDetailPageContentProps["calendarExamDateKeys"];
export let calendarMonthDays: SectionDetailPageContentProps["calendarMonthDays"];
export let calendarMonthLabel: string;
export let calendarMonthOffset: number;
export let calendarScheduleDateKeys: SectionDetailPageContentProps["calendarScheduleDateKeys"];
export let canManageSelectedHomework: boolean;
export let canWriteHomework: boolean;
export let clipboardError: string;
export let clipboardMessage: string;
export let closeCalendarDialog: SectionDetailPageContentProps["closeCalendarDialog"];
export let closeCreateHomeworkDialog: SectionDetailPageContentProps["closeCreateHomeworkDialog"];
export let closeSubscribeDialog: SectionDetailPageContentProps["closeSubscribeDialog"];
export let commentTargets: SectionDetailPageContentProps["commentTargets"];
export let commentsCopy: SectionDetailPageContentProps["commentsCopy"];
export let commonCopy: SectionDetailPageContentProps["commonCopy"];
export let copiedCalendarTarget: SectionDetailPageContentProps["copiedCalendarTarget"];
export let copyText: SectionDetailPageContentProps["copyText"];
export let courseName: string;
export let courseSecondaryName: string;
export let createHomework: SectionDetailPageContentProps["createHomework"];
export let createHomeworkPublishedAt: string;
export let createHomeworkSubmissionDueAt: string;
export let createHomeworkSubmissionStartAt: string;
export let dateKey: SectionDetailPageContentProps["dateKey"];
export let data: SectionDetailPageData;
export let deleteHomework: SectionDetailPageContentProps["deleteHomework"];
export let deleteHomeworkTarget: SectionDetailPageContentProps["deleteHomeworkTarget"];
export let editHomeworkMessage: string;
export let editHomeworkPublishedAt: string;
export let editHomeworkSubmissionDueAt: string;
export let editHomeworkSubmissionStartAt: string;
export let editingHomework: boolean;
export let fmtDate: SectionDetailPageContentProps["fmtDate"];
export let fmtDateTime: SectionDetailPageContentProps["fmtDateTime"];
export let form: SectionDetailPageContentProps["form"];
export let formatMessage: FormatMessage;
export let hasSemesterEnd: boolean;
export let hasSemesterStart: boolean;
export let homeworkAuditActionLabel: SectionDetailPageContentProps["homeworkAuditActionLabel"];
export let homeworkAuditActorName: SectionDetailPageContentProps["homeworkAuditActorName"];
export let homeworkAuditLogs: SectionDetailPageContentProps["homeworkAuditLogs"];
export let homeworkCopy: SectionDetailPageContentProps["homeworkCopy"];
export let homeworkDescriptionMaxLength: number;
export let homeworkMessage: string;
export let homeworkStatus: SectionDetailPageContentProps["homeworkStatus"];
export let homeworkTitleMaxLength: number;
export let homeworkView: SectionDetailPageContentProps["homeworkView"];
export let homeworks: SectionDetailPageContentProps["homeworks"];
export let isCalendarDialogOpen: boolean;
export let isHomeworkAuditDialogOpen: boolean;
export let notAvailable: string;
export let openCalendarDialog: SectionDetailPageContentProps["openCalendarDialog"];
export let openCreateHomeworkDialog: SectionDetailPageContentProps["openCreateHomeworkDialog"];
export let openSubscribeDialog: SectionDetailPageContentProps["openSubscribeDialog"];
export let periodDetailRows: SectionDetailPageContentProps["periodDetailRows"];
export let primaryName: SectionDetailPageContentProps["primaryName"];
export let sectionCalendarEvents: SectionDetailPageContentProps["sectionCalendarEvents"];
export let sectionCalendarGridWeeks: SectionDetailPageContentProps["sectionCalendarGridWeeks"];
export let sectionCopy: SectionDetailPageContentProps["sectionCopy"];
export let sectionTeachersLabel: SectionDetailPageContentProps["sectionTeachersLabel"];
export let selectedHomework: SectionDetailPageContentProps["selectedHomework"];
export let semesterDate: SectionDetailPageContentProps["semesterDate"];
export let setActiveTab: SectionDetailPageContentProps["setActiveTab"];
export let setDeleteHomeworkTarget: SectionDetailPageContentProps["setDeleteHomeworkTarget"];
export let setHomeworkView: SectionDetailPageContentProps["setHomeworkView"];
export let setHomeworkAuditDialogOpen: BooleanSetter;
export let setCalendarDialogOpen: BooleanSetter;
export let setSelectedHomework: SectionDetailPageContentProps["setSelectedHomework"];
export let showCreateHomework: boolean;
export let showSubscribeDialog: boolean;
export let singleCalendarUrl: string;
export let startEditHomework: SectionDetailPageContentProps["startEditHomework"];
export let subscriptionAction: SectionDetailPageContentProps["subscriptionAction"];
export let subscriptionCalendarUrl: string;
export let subscriptionPendingAction: SectionDetailPageContentProps["subscriptionPendingAction"];
export let tabs: SectionDetailPageContentProps["tabs"];
export let teacherName: SectionDetailPageContentProps["teacherName"];
export let todayCalendarKey: SectionDetailPageContentProps["todayCalendarKey"];
export let toggleHomeworkCompletion: SectionDetailPageContentProps["toggleHomeworkCompletion"];
export let unscheduledCalendarEvents: SectionDetailPageContentProps["unscheduledCalendarEvents"];
export let updateHomework: SectionDetailPageContentProps["updateHomework"];
export let viewer: SectionDetailPageContentProps["viewer"];
export let visibleCalendarMonth: Date;
export let yesNo: SectionDetailPageContentProps["yesNo"];
export let applyCreateDueAtSemesterEnd: SectionDetailPageContentProps["applyCreateDueAtSemesterEnd"];
export let applyCreateDueInMonth: SectionDetailPageContentProps["applyCreateDueInMonth"];
export let applyCreateDueInWeek: SectionDetailPageContentProps["applyCreateDueInWeek"];
export let applyCreatePublishNow: SectionDetailPageContentProps["applyCreatePublishNow"];
export let applyCreateStartAtSemesterStart: SectionDetailPageContentProps["applyCreateStartAtSemesterStart"];
export let applyCreateStartNow: SectionDetailPageContentProps["applyCreateStartNow"];
export let applyEditDueAtSemesterEnd: SectionDetailPageContentProps["applyEditDueAtSemesterEnd"];
export let applyEditDueInMonth: SectionDetailPageContentProps["applyEditDueInMonth"];
export let applyEditDueInWeek: SectionDetailPageContentProps["applyEditDueInWeek"];
export let applyEditPublishNow: SectionDetailPageContentProps["applyEditPublishNow"];
export let applyEditStartAtSemesterStart: SectionDetailPageContentProps["applyEditStartAtSemesterStart"];
export let applyEditStartNow: SectionDetailPageContentProps["applyEditStartNow"];
export let cancelEditHomework: SectionDetailPageContentProps["cancelEditHomework"];
export let isSameMonth: IsSameMonth;
</script>

<section class="grid gap-5">
  <SectionDetailHeader
    {commonCopy}
    {courseName}
    {courseSecondaryName}
    formError={form?.error}
    {notAvailable}
    onOpenCalendar={openCalendarDialog}
    onOpenSubscribe={openSubscribeDialog}
    {primaryName}
    section={data.section}
    {sectionCopy}
    {subscriptionAction}
    {subscriptionPendingAction}
    viewer={{ isSubscribed: viewer.isSubscribed === true }}
  />

  <SectionDetailMainContent
    {activeTab}
    {calendarExamDateKeys}
    {calendarMonthDays}
    {calendarMonthLabel}
    bind:calendarMonthOffset
    {calendarScheduleDateKeys}
    {canWriteHomework}
    {commentTargets}
    {commonCopy}
    {data}
    {dateKey}
    {fmtDate}
    {fmtDateTime}
    {formatMessage}
    {homeworkCopy}
    {homeworkStatus}
    {homeworkView}
    {homeworks}
    {isSameMonth}
    {notAvailable}
    {openCalendarDialog}
    {openCreateHomeworkDialog}
    {periodDetailRows}
    {primaryName}
    {sectionCalendarEvents}
    {sectionCalendarGridWeeks}
    {sectionCopy}
    {sectionTeachersLabel}
    {setActiveTab}
    {setHomeworkAuditDialogOpen}
    {setHomeworkView}
    {setSelectedHomework}
    {tabs}
    {teacherName}
    {todayCalendarKey}
    {unscheduledCalendarEvents}
    {viewer}
    {visibleCalendarMonth}
    {yesNo}
  />
</section>

<SectionDetailDialogs
  {auditLogsForHomework}
  {canManageSelectedHomework}
  {canWriteHomework}
  {cancelEditHomework}
  {clipboardError}
  {clipboardMessage}
  {closeCalendarDialog}
  {closeCreateHomeworkDialog}
  {closeSubscribeDialog}
  {commentsCopy}
  {commonCopy}
  {copiedCalendarTarget}
  {copyText}
  {createHomework}
  bind:createHomeworkPublishedAt
  bind:createHomeworkSubmissionDueAt
  bind:createHomeworkSubmissionStartAt
  {data}
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
  {isCalendarDialogOpen}
  {isHomeworkAuditDialogOpen}
  {sectionCopy}
  {selectedHomework}
  {semesterDate}
  {setCalendarDialogOpen}
  {setDeleteHomeworkTarget}
  {setHomeworkAuditDialogOpen}
  {setSelectedHomework}
  {showCreateHomework}
  {showSubscribeDialog}
  {singleCalendarUrl}
  {startEditHomework}
  {subscriptionAction}
  {subscriptionCalendarUrl}
  {subscriptionPendingAction}
  {toggleHomeworkCompletion}
  {updateHomework}
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
/>
