<script lang="ts">
import type { DashboardBusCopy } from "@/features/dashboard/lib/bus-tab-types";
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
  DashboardPageData,
  DashboardRootCopy,
  DashboardSectionCopy,
  DashboardTodosCopy,
  LinkView,
  SignedDashboardData,
  SignedLinkGroup,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import type { SignedTabId } from "@/features/dashboard/lib/dashboard-nav";
import type {
  DashboardCalendarTabHref,
  DashboardCalendarTabProps,
} from "./dashboard-calendar-component-types";
import type { FormatMessage } from "./dashboard-component-types";
import type { DashboardTaskTabsProps } from "./dashboard-task-component-types";
import type { OverviewCalendarTimelineItemsForDay } from "./overview-tab-types";
import SignedDashboardOverviewBranch from "./SignedDashboardOverviewBranch.svelte";
import SignedDashboardPublicTabs from "./SignedDashboardPublicTabs.svelte";
import SignedDashboardSubscriptionsBranch from "./SignedDashboardSubscriptionsBranch.svelte";
import SignedDashboardTabsNav from "./SignedDashboardTabsNav.svelte";
import SignedDashboardTaskTabs from "./SignedDashboardTaskTabs.svelte";
import type {
  DashboardSubscriptionsTabProps,
  MatchedImportSection,
  NameFormatter,
} from "./subscription-tab-types";

export let addDays: DashboardCalendarTabProps["addDays"];
export let addMonths: DashboardCalendarTabProps["addMonths"];
export let busCopy: DashboardBusCopy;
export let calendarData: DashboardCalendarTabProps["calendarData"];
export let calendarEventParts: DashboardCalendarTabProps["calendarEventParts"];
export let calendarEventsForDay: DashboardCalendarTabProps["calendarEventsForDay"];
export let calendarExamDetail: DashboardCalendarTabProps["calendarExamDetail"];
export let calendarHomeworkDetail: DashboardCalendarTabProps["calendarHomeworkDetail"];
export let calendarHomeworkHref: DashboardCalendarTabProps["calendarHomeworkHref"];
export let calendarMonth: DashboardCalendarTabProps["calendarMonth"];
export let calendarSemesterId: DashboardCalendarTabProps["calendarSemesterId"];
export let calendarSemesterIndex: DashboardCalendarTabProps["calendarSemesterIndex"];
export let calendarSessionDetail: DashboardCalendarTabProps["calendarSessionDetail"];
export let calendarTodoDetail: DashboardCalendarTabProps["calendarTodoDetail"];
export let calendarTimelineItemsForDay: OverviewCalendarTimelineItemsForDay;
export let calendarView: DashboardCalendarTabProps["calendarView"];
export let calendarWeekLabel: DashboardCalendarTabProps["calendarWeekLabel"];
export let calendarWeekStart: DashboardCalendarTabProps["calendarWeekStart"];
export let calendarWeekdayLabels: DashboardCalendarTabProps["calendarWeekdayLabels"];
export let canMatchImportSections: boolean;
export let commentsCopy: DashboardTaskTabsProps["commentsCopy"];
export let commonCopy: DashboardCommonCopy;
export let confirmImportSections: DashboardSubscriptionsTabProps["confirmImportSections"];
export let copy: DashboardRootCopy;
export let copyCalendarLink: DashboardCalendarTabProps["copyCalendarLink"];
export let createHomeworkAction: DashboardTaskTabsProps["createHomeworkAction"];
export let createHomeworkAdvancedOpen: boolean;
export let createHomeworkError: string;
export let createHomeworkPublishedAt: DashboardTaskTabsProps["createHomeworkPublishedAt"];
export let createHomeworkSectionId: DashboardTaskTabsProps["createHomeworkSectionId"];
export let createHomeworkSubmissionDueAt: DashboardTaskTabsProps["createHomeworkSubmissionDueAt"];
export let createHomeworkSubmissionStartAt: DashboardTaskTabsProps["createHomeworkSubmissionStartAt"];
export let createTodoAction: DashboardTaskTabsProps["createTodoAction"];
export let createTodoError: string;
export let dashboardCopy: DashboardDashboardCopy;
export let dashboardTabHref: DashboardCalendarTabHref;
export let data: DashboardPageData;
export let deleteTodo: DashboardTaskTabsProps["deleteTodo"];
export let editTodoError: string;
export let editingTodo: DashboardTaskTabsProps["editingTodo"];
export let examFilter: DashboardTaskTabsProps["examFilter"];
export let examMetadataLabels: DashboardTaskTabsProps["examMetadataLabels"];
export let examRows: DashboardTaskTabsProps["examRows"];
export let examTimeLabel: DashboardTaskTabsProps["examTimeLabel"];
export let examView: DashboardTaskTabsProps["examView"];
export let filteredExamRows: DashboardTaskTabsProps["filteredExamRows"];
export let filteredTodos: DashboardTaskTabsProps["filteredTodos"];
export let formatMessage: FormatMessage;
export let homeworkCopy: DashboardTaskTabsProps["homeworkCopy"];
export let homeworkDescriptionMaxLength: number;
export let homeworkFilter: DashboardTaskTabsProps["homeworkFilter"];
export let homeworkItems: DashboardTaskTabsProps["homeworkItems"];
export let homeworkReferenceDate: DashboardTaskTabsProps["homeworkReferenceDate"];
export let homeworkSavingById: DashboardTaskTabsProps["homeworkSavingById"];
export let homeworkTitleMaxLength: number;
export let homeworkView: DashboardTaskTabsProps["homeworkView"];
export let homeworksCopy: DashboardTaskTabsProps["homeworksCopy"];
export let isBulkImportOpen: boolean;
export let isConfirmImportOpen: boolean;
export let isCreatingHomework: boolean;
export let isCreatingTodo: boolean;
export let isImportingSections: boolean;
export let isMatchingSections: boolean;
export let isUpdatingTodo: boolean;
export let linkActionError: string;
export let linkIconLabel: (icon: string) => string;
export let linkReturnTo: string;
export let linkSearchInput: HTMLInputElement | null;
export let linkSearchQuery: string;
export let linkView: LinkView;
export let matchedSections: MatchedImportSection[];
export let monthWeeks: DashboardCalendarTabProps["monthWeeks"];
export let namePrimary: NameFormatter;
export let nameSecondary: NameFormatter;
export let openBulkImportDialog: DashboardSubscriptionsTabProps["openBulkImportDialog"];
export let openCreateHomeworkDialog: DashboardTaskTabsProps["openCreateHomeworkDialog"];
export let openTodoEditor: DashboardTaskTabsProps["openTodoEditor"];
export let overviewLinkItems: DashboardOverviewLinkItem[];
export let pendingRemoveSectionId: DashboardSubscriptionsTabProps["pendingRemoveSectionId"];
export let removeSubscribedSection: DashboardSubscriptionsTabProps["removeSubscribedSection"];
export let removingSectionId: DashboardSubscriptionsTabProps["removingSectionId"];
export let resetBulkImport: DashboardSubscriptionsTabProps["resetBulkImport"];
export let sectionCopy: DashboardSectionCopy;
export let selectedCreateHomeworkSection: DashboardTaskTabsProps["selectedCreateHomeworkSection"];
export let selectedHomework: DashboardTaskTabsProps["selectedHomework"];
export let selectedImportCount: number;
export let selectedImportSectionIdSet: Set<number>;
export let selectedTodo: DashboardTaskTabsProps["selectedTodo"];
export let sessionHref: DashboardCalendarTabProps["sessionHref"];
export let setCalendarMonth: DashboardCalendarTabProps["setCalendarMonth"];
export let setCalendarSemester: DashboardCalendarTabProps["setCalendarSemester"];
export let setCalendarView: DashboardCalendarTabProps["setCalendarView"];
export let setCalendarWeek: DashboardCalendarTabProps["setCalendarWeek"];
export let setExamView: DashboardTaskTabsProps["setExamView"];
export let setHomeworkView: DashboardTaskTabsProps["setHomeworkView"];
export let setLinkView: (view: LinkView) => void;
export let setTodoView: DashboardTaskTabsProps["setTodoView"];
export let showCreateHomework: boolean;
export let showCreateTodo: boolean;
export let signedData: SignedDashboardData;
export let signedLinkGroups: SignedLinkGroup[];
export let signedTabBadge: (
  data: SignedDashboardData,
  id: SignedTabId,
) => number | null;
export let signedTabs: ReadonlyArray<readonly [SignedTabId, string]>;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let subscriptionActionError: string;
export let subscriptionActionMessage: string;
export let subscriptionsCopy: DashboardSubscriptionsTabProps["subscriptionsCopy"];
export let todoActionError: string;
export let todoContentMaxLength: number;
export let todoFilter: DashboardTaskTabsProps["todoFilter"];
export let todoPriorityClass: DashboardTaskTabsProps["todoPriorityClass"];
export let todoPriorityOptions: DashboardTaskTabsProps["todoPriorityOptions"];
export let todoSavingById: DashboardTaskTabsProps["todoSavingById"];
export let todoTitleMaxLength: number;
export let todoView: DashboardTaskTabsProps["todoView"];
export let todosCopy: DashboardTodosCopy;
export let toggleHomeworkCompletion: DashboardTaskTabsProps["toggleHomeworkCompletion"];
export let toggleImportSectionSelection: DashboardSubscriptionsTabProps["toggleImportSectionSelection"];
export let toggleTodoCompletion: DashboardTaskTabsProps["toggleTodoCompletion"];
export let unmatchedSectionCodes: string[];
export let updateTodoAction: DashboardTaskTabsProps["updateTodoAction"];
export let updatingDashboardLinkSlug: string | null;
export let applyHomeworkDueAtSemesterEnd: DashboardTaskTabsProps["applyHomeworkDueAtSemesterEnd"];
export let applyHomeworkDueInMonth: DashboardTaskTabsProps["applyHomeworkDueInMonth"];
export let applyHomeworkDueInWeek: DashboardTaskTabsProps["applyHomeworkDueInWeek"];
export let applyHomeworkStartNow: DashboardTaskTabsProps["applyHomeworkStartNow"];
export let bulkImportError: string;
export let bulkImportMessage: string;
export let bulkImportSemesterId: string;
export let bulkImportText: string;
export let matchImportSections: DashboardSubscriptionsTabProps["matchImportSections"];
</script>

<SignedDashboardTabsNav
  {dashboardCopy}
  {dashboardTabHref}
  {signedData}
  {signedTabBadge}
  {signedTabs}
/>

{#if signedData.tab === "overview"}
  <SignedDashboardOverviewBranch
    {calendarTimelineItemsForDay}
    {commonCopy}
    {copy}
    {dashboardCopy}
    {dashboardTabHref}
    {data}
    {linkIconLabel}
    {overviewLinkItems}
    {sectionCopy}
    {subscriptionsCopy}
    {signedData}
    {submitDashboardLinkPin}
    {todoPriorityClass}
    {todosCopy}
    {updatingDashboardLinkSlug}
  />
{:else if signedData.tab === "todos" || signedData.tab === "homeworks" || signedData.tab === "exams"}
  <SignedDashboardTaskTabs
    activeTab={signedData.tab}
    {applyHomeworkDueAtSemesterEnd}
    {applyHomeworkDueInMonth}
    {applyHomeworkDueInWeek}
    {applyHomeworkStartNow}
    {commentsCopy}
    {commonCopy}
    {createHomeworkAction}
    {createTodoAction}
    {dashboardCopy}
    {dashboardTabHref}
    {data}
    {deleteTodo}
    {examMetadataLabels}
    {examRows}
    {examTimeLabel}
    {examView}
    {filteredExamRows}
    {filteredTodos}
    {homeworkCopy}
    {homeworkDescriptionMaxLength}
    {homeworkReferenceDate}
    {homeworkTitleMaxLength}
    {homeworksCopy}
    {isCreatingTodo}
    {isUpdatingTodo}
    {namePrimary}
    {openCreateHomeworkDialog}
    {openTodoEditor}
    {sectionCopy}
    {selectedCreateHomeworkSection}
    {setExamView}
    {setHomeworkView}
    {setTodoView}
    {signedData}
    {subscriptionsCopy}
    {todoActionError}
    {todoContentMaxLength}
    {todoPriorityClass}
    {todoPriorityOptions}
    {todoSavingById}
    {todoTitleMaxLength}
    {todoView}
    {todosCopy}
    {toggleHomeworkCompletion}
    {toggleTodoCompletion}
    {updateTodoAction}
    bind:createHomeworkAdvancedOpen
    bind:createHomeworkError
    bind:createHomeworkPublishedAt
    bind:createHomeworkSectionId
    bind:createHomeworkSubmissionDueAt
    bind:createHomeworkSubmissionStartAt
    bind:createTodoError
    bind:editTodoError
    bind:editingTodo
    bind:examFilter
    bind:homeworkFilter
    bind:homeworkItems
    bind:homeworkSavingById
    bind:homeworkView
    bind:isCreatingHomework
    bind:selectedHomework
    bind:selectedTodo
    bind:showCreateHomework
    bind:showCreateTodo
    bind:todoFilter
  />
{:else if signedData.tab === "subscriptions" && signedData.subscriptions}
  {@const subscriptionsSignedData = signedData as DashboardSubscriptionsTabProps["signedData"]}
  <SignedDashboardSubscriptionsBranch
    {dashboardCopy}
    {sectionCopy}
    {subscriptionsCopy}
    signedData={subscriptionsSignedData}
    {selectedImportSectionIdSet}
    {selectedImportCount}
    {canMatchImportSections}
    {formatMessage}
    {copyCalendarLink}
    {namePrimary}
    {nameSecondary}
    {resetBulkImport}
    {openBulkImportDialog}
    {toggleImportSectionSelection}
    {matchImportSections}
    {confirmImportSections}
    {removeSubscribedSection}
    {bulkImportMessage}
    {bulkImportError}
    {isMatchingSections}
    {isImportingSections}
    {pendingRemoveSectionId}
    {removingSectionId}
    {subscriptionActionMessage}
    {subscriptionActionError}
    {matchedSections}
    {unmatchedSectionCodes}
    bind:isBulkImportOpen
    bind:isConfirmImportOpen
    bind:bulkImportSemesterId
    bind:bulkImportText
  />
{:else}
  {@const calendarSignedData = signedData as DashboardCalendarTabProps["signedData"]}
  <SignedDashboardPublicTabs
    {copy}
    {commonCopy}
    {busCopy}
    {dashboardCopy}
    {sectionCopy}
    {subscriptionsCopy}
    {calendarWeekdayLabels}
    signedData={calendarSignedData}
    {dashboardTabHref}
    {formatMessage}
    {copyCalendarLink}
    {sessionHref}
    {setCalendarView}
    {setCalendarMonth}
    {setCalendarWeek}
    {setCalendarSemester}
    {addDays}
    {addMonths}
    {monthWeeks}
    {calendarEventsForDay}
    {calendarWeekLabel}
    {calendarEventParts}
    {calendarHomeworkHref}
    {calendarSessionDetail}
    {calendarExamDetail}
    {calendarHomeworkDetail}
    {calendarTodoDetail}
    {calendarSemesterIndex}
    {calendarView}
    {calendarMonth}
    {calendarWeekStart}
    {calendarSemesterId}
    {calendarData}
    {linkActionError}
    {linkIconLabel}
    {linkReturnTo}
    bind:linkSearchInput
    bind:linkSearchQuery
    {linkView}
    {setLinkView}
    {signedLinkGroups}
    {submitDashboardLinkPin}
    {updatingDashboardLinkSlug}
  />
{/if}
