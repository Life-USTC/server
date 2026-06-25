<script lang="ts">
import { onMount } from "svelte";
import {
  addDays,
  addMonths,
  calendarEventParts,
  calendarEventsForDay,
  monthWeeks,
  weekDaysFor,
} from "@/features/dashboard/lib/calendar";
import {
  calendarExamDetail,
  calendarHomeworkDetail,
  calendarSemesterIndex,
  calendarSessionDetail,
} from "@/features/dashboard/lib/calendar-display";
import { createDashboardCalendarActions } from "@/features/dashboard/lib/dashboard-controller-calendar-actions";
import { createDashboardCalendarCopyActions } from "@/features/dashboard/lib/dashboard-controller-calendar-copy-actions";
import { createDashboardCalendarDisplayActions } from "@/features/dashboard/lib/dashboard-controller-calendar-display-actions";
import { createDashboardCardViewActions } from "@/features/dashboard/lib/dashboard-controller-card-view-actions";
import { createDashboardCreateHomeworkActions } from "@/features/dashboard/lib/dashboard-controller-create-homework-actions";
import { createDashboardControllerDefaultState } from "@/features/dashboard/lib/dashboard-controller-default-state";
import {
  applyLocalHomeworkItemsToSignedData,
  buildDashboardControllerDerivedState,
} from "@/features/dashboard/lib/dashboard-controller-derived-state";
import { createDashboardDisplayActions } from "@/features/dashboard/lib/dashboard-controller-display-actions";
import { createDashboardFormSubmitActions } from "@/features/dashboard/lib/dashboard-controller-form-actions";
import {
  type AnonymousDashboardData,
  type AnonymousLinkGroup,
  buildCalendarWeekdayLabels,
  buildSignedTabs,
  type DashboardActionData,
  type DashboardLinkItem,
  type DashboardPageData,
  type DashboardViewState,
  isSignedDashboardData,
  type TodoItem,
  todoPriorityOrder,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { createDashboardHomeworkStateActions } from "@/features/dashboard/lib/dashboard-controller-homework-state-actions";
import { createDashboardLinkStateActions } from "@/features/dashboard/lib/dashboard-controller-link-state-actions";
import { mountDashboardController } from "@/features/dashboard/lib/dashboard-controller-mount";
import { createDashboardSubscriptionActions } from "@/features/dashboard/lib/dashboard-controller-subscription-actions";
import { createDashboardTodoActions } from "@/features/dashboard/lib/dashboard-controller-todo-actions";
import { linkIconLabel } from "@/features/dashboard/lib/dashboard-link-ui";
import {
  dashboardTabHref,
  signedTabBadge,
  signedTabIds,
} from "@/features/dashboard/lib/dashboard-nav";
import {
  examReferenceNow,
  examTimeLabel,
} from "@/features/dashboard/lib/exams";
import { namePrimary } from "@/features/dashboard/lib/localized-names";
import {
  dayStart,
  fmtTime,
  formatMessage,
  referenceDate,
} from "@/features/dashboard/lib/overview";
import {
  todoPriorityOptions as buildTodoPriorityOptions,
  todoPriorityClass,
} from "@/features/dashboard/lib/todos";
import { invalidateAll, replaceState } from "$app/navigation";
import { page } from "$app/stores";
import { Alert } from "$lib/components/ui/alert/index.js";
import AnonymousDashboardView from "./AnonymousDashboardView.svelte";
import DashboardStatusAlerts from "./DashboardStatusAlerts.svelte";
import type { DashboardCalendarTabProps } from "./dashboard-calendar-component-types";
import SignedDashboardOverviewBranch from "./SignedDashboardOverviewBranch.svelte";
import SignedDashboardPublicTabs from "./SignedDashboardPublicTabs.svelte";
import SignedDashboardSubscriptionsBranch from "./SignedDashboardSubscriptionsBranch.svelte";
import SignedDashboardTabsNav from "./SignedDashboardTabsNav.svelte";
import SignedDashboardTaskTabs from "./SignedDashboardTaskTabs.svelte";
import type { DashboardSubscriptionsTabProps } from "./subscription-tab-types";

type PageData = DashboardPageData;
type ActionData = DashboardActionData;

export let data: PageData;
export let form: ActionData | undefined = undefined;

let {
  anonymousData,
  anonymousLinkGroups,
  bulkImportError,
  bulkImportMessage,
  bulkImportSemesterId,
  bulkImportText,
  calendarCopyError,
  calendarCopyMessage,
  calendarData,
  calendarMonth,
  calendarSemesterId,
  calendarView,
  calendarWeekStart,
  createHomeworkAdvancedOpen,
  createHomeworkError,
  createHomeworkPublishedAt,
  createHomeworkSectionId,
  createHomeworkSubmissionDueAt,
  createHomeworkSubmissionStartAt,
  createTodoError,
  dashboardLinkItems,
  editTodoError,
  editingTodo,
  examFilter,
  examRows,
  examView,
  filteredExamRows,
  filteredTodos,
  homeworkFilter,
  homeworkItems,
  homeworkReferenceDate,
  homeworkSavingById,
  homeworkView,
  isBulkImportOpen,
  isConfirmImportOpen,
  isCreatingHomework,
  isCreatingTodo,
  isImportingSections,
  isMatchingSections,
  isUpdatingTodo,
  linkActionError,
  linkReturnTo,
  linkSearchInput,
  linkSearchQuery,
  linkView,
  matchedSections,
  overviewLinkItems,
  pendingRemoveSectionId,
  removingSectionId,
  selectedHomework,
  selectedImportSectionIds,
  selectedTodo,
  showCreateHomework,
  showCreateTodo,
  signedData,
  signedLinkGroups,
  subscriptionActionError,
  subscriptionActionMessage,
  todoActionError,
  todoFilter,
  todoItems,
  todoSavingById,
  todoView,
  unmatchedSectionCodes,
  updatingDashboardLinkSlug,
} = createDashboardControllerDefaultState();
let dashboardLinkSourceItems: DashboardLinkItem[] = [];
let overviewLinkSourceItems: DashboardLinkItem[] = [];
let linkSourceData: PageData | null = null;
$: copy = data.copy;
$: actionError = form?.error ?? "";
$: commonCopy = copy.common;
$: dashboardCopy = copy.dashboard;
$: busCopy = copy.bus;
$: homepageCopy = copy.homepage;
$: homeworksCopy = copy.homeworks;
$: homeworkCopy = copy.myHomeworks;
$: sectionCopy = copy.sectionDetail;
$: subscriptionsCopy = copy.subscriptions;
$: todosCopy = copy.todos;
$: commentsCopy = copy.comments;
$: todoPriorityOptions = buildTodoPriorityOptions(todoPriorityOrder, todosCopy);
$: calendarWeekdayLabels = buildCalendarWeekdayLabels(sectionCopy);
$: signedTabs = buildSignedTabs(signedTabIds, dashboardCopy);
$: dashboardLinkGroupLabels = dashboardCopy.linkHub.groups;
$: if (data !== linkSourceData) {
  const signedPageData = isSignedDashboardData(data) ? data : null;
  dashboardLinkSourceItems = signedPageData?.links?.dashboardLinks ?? [];
  overviewLinkSourceItems =
    signedPageData?.overview?.overviewLinks.slice(0, 4) ?? [];
  linkSourceData = data;
}

function openTodoEditor(todo: TodoItem) {
  selectedTodo = null;
  editTodoError = "";
  editingTodo = todo;
}

const { copyCalendarLink } = createDashboardCalendarCopyActions({
  getCopyLabels: () => subscriptionsCopy,
  setCalendarCopyError: (value) => {
    calendarCopyError = value;
  },
  setCalendarCopyMessage: (value) => {
    calendarCopyMessage = value;
  },
});

const {
  applyHomeworkDueAtSemesterEnd,
  applyHomeworkDueInMonth,
  applyHomeworkDueInWeek,
  applyHomeworkStartNow,
  openCreateHomeworkDialog,
  selectedCreateHomeworkSection,
} = createDashboardCreateHomeworkActions({
  getCreateHomeworkSectionId: () => createHomeworkSectionId,
  getSections: () => signedData?.homeworks?.sections ?? [],
  setCreateHomeworkAdvancedOpen: (value) => {
    createHomeworkAdvancedOpen = value;
  },
  setCreateHomeworkError: (value) => {
    createHomeworkError = value;
  },
  setCreateHomeworkPublishedAt: (value) => {
    createHomeworkPublishedAt = value;
  },
  setCreateHomeworkSectionId: (value) => {
    createHomeworkSectionId = value;
  },
  setCreateHomeworkSubmissionDueAt: (value) => {
    createHomeworkSubmissionDueAt = value;
  },
  setCreateHomeworkSubmissionStartAt: (value) => {
    createHomeworkSubmissionStartAt = value;
  },
  setShowCreateHomework: (value) => {
    showCreateHomework = value;
  },
});

const { deleteTodo, toggleTodoCompletion } = createDashboardTodoActions({
  getEditingTodo: () => editingTodo,
  getSelectedTodo: () => selectedTodo,
  getTodoItems: () => todoItems,
  getTodoSavingById: () => todoSavingById,
  getTodosCopy: () => todosCopy,
  invalidateAll,
  setEditingTodo: (value) => {
    editingTodo = value;
  },
  setSelectedTodo: (value) => {
    selectedTodo = value;
  },
  setTodoActionError: (value) => {
    todoActionError = value;
  },
  setTodoItems: (value) => {
    todoItems = value;
  },
  setTodoSavingById: (value) => {
    todoSavingById = value;
  },
});

const { examMetadataLabels, nameSecondary } = createDashboardDisplayActions({
  getCountLabel: () => sectionCopy.examCount,
  getFinalLabel: () => sectionCopy.examTypeFinal,
  getLocale: () => data.locale as "en-us" | "zh-cn",
  getMidtermLabel: () => sectionCopy.examTypeMidterm,
});

const { createHomeworkAction, createTodoAction, updateTodoAction } =
  createDashboardFormSubmitActions({
    getHomeworksCopy: () => homeworksCopy,
    getTodosCopy: () => todosCopy,
    setCreateHomeworkError: (value) => {
      createHomeworkError = value;
    },
    setCreateTodoError: (value) => {
      createTodoError = value;
    },
    setCreatingHomework: (value) => {
      isCreatingHomework = value;
    },
    setCreatingTodo: (value) => {
      isCreatingTodo = value;
    },
    setEditTodoError: (value) => {
      editTodoError = value;
    },
    setShowCreateTodo: (value) => {
      showCreateTodo = value;
    },
    setUpdatingTodo: (value) => {
      isUpdatingTodo = value;
    },
  });

const {
  clearPendingRemoveSection,
  confirmImportSections,
  matchImportSections,
  openBulkImportDialog,
  removeSubscribedSection,
  resetBulkImport,
  toggleImportSectionSelection,
} = createDashboardSubscriptionActions({
  getBulkImportSemesterId: () => bulkImportSemesterId,
  getBulkImportText: () => bulkImportText,
  getCurrentSemesterId: () =>
    signedData?.subscriptions?.currentSemesterId ?? null,
  getPendingRemoveSectionId: () => pendingRemoveSectionId,
  getSelectedImportSectionIds: () => selectedImportSectionIds,
  getSubscriptionsCopy: () => subscriptionsCopy,
  invalidateAll,
  setBulkImportError: (value) => {
    bulkImportError = value;
  },
  setBulkImportMessage: (value) => {
    bulkImportMessage = value;
  },
  setBulkImportOpen: (value) => {
    isBulkImportOpen = value;
  },
  setBulkImportSemesterId: (value) => {
    bulkImportSemesterId = value;
  },
  setBulkImportText: (value) => {
    bulkImportText = value;
  },
  setConfirmImportOpen: (value) => {
    isConfirmImportOpen = value;
  },
  setImportingSections: (value) => {
    isImportingSections = value;
  },
  setMatchedSections: (value) => {
    matchedSections = value;
  },
  setMatchingSections: (value) => {
    isMatchingSections = value;
  },
  setPendingRemoveSectionId: (value) => {
    pendingRemoveSectionId = value;
  },
  setRemovingSectionId: (value) => {
    removingSectionId = value;
  },
  setSelectedImportSectionIds: (value) => {
    selectedImportSectionIds = value;
  },
  setSubscriptionActionError: (value) => {
    subscriptionActionError = value;
  },
  setSubscriptionActionMessage: (value) => {
    subscriptionActionMessage = value;
  },
  setUnmatchedSectionCodes: (value) => {
    unmatchedSectionCodes = value;
  },
});

function applyDashboardViewState(state: DashboardViewState) {
  homeworkView = state.homeworkView;
  todoView = state.todoView;
  examView = state.examView;
  linkView = state.linkView;
}

const { setExamView, setHomeworkView, setTodoView } =
  createDashboardCardViewActions({
    applyDashboardViewState,
    replaceState: (href) => {
      replaceState(href, {});
    },
  });

const { toggleHomeworkCompletion } = createDashboardHomeworkStateActions({
  getHomeworkItems: () => homeworkItems,
  getHomeworkSavingById: () => homeworkSavingById,
  getHomeworksCopy: () => homeworksCopy,
  getSelectedHomework: () => selectedHomework,
  setHomeworkItems: (value) => {
    homeworkItems = value;
  },
  setHomeworkSavingById: (value) => {
    homeworkSavingById = value;
  },
  setSelectedHomework: (value) => {
    selectedHomework = value;
  },
});

const { setLinkView, submitDashboardLinkPin } = createDashboardLinkStateActions(
  {
    applyDashboardViewState,
    getDashboardCopy: () => dashboardCopy,
    getDashboardLinkItems: () => dashboardLinkSourceItems,
    getLinkReturnTo: () => linkReturnTo,
    getOverviewLinkItems: () => overviewLinkSourceItems,
    getUpdatingDashboardLinkSlug: () => updatingDashboardLinkSlug,
    replaceState: (href) => {
      replaceState(href, {});
    },
    setDashboardLinkItems: (value) => {
      dashboardLinkSourceItems = value;
    },
    setLinkActionError: (value) => {
      linkActionError = value;
    },
    setLinkReturnTo: (value) => {
      linkReturnTo = value;
    },
    setOverviewLinkItems: (value) => {
      overviewLinkSourceItems = value;
    },
    setUpdatingDashboardLinkSlug: (value) => {
      updatingDashboardLinkSlug = value;
    },
  },
);

const {
  calendarHomeworkHref,
  calendarTimelineItemsForDay,
  calendarTodoDetail,
  calendarWeekLabel,
  sessionHref,
} = createDashboardCalendarDisplayActions({
  getCommonCourseLabel: () => commonCopy.courses,
  getEventLabels: () => ({
    exam: copy.CalendarEventCard.exam,
    homework: copy.CalendarEventCard.homework,
    todo: copy.CalendarEventCard.todo,
  }),
  getTodoPriorityLabel: (priority) => todosCopy.priority[priority],
  getWeekNumberTemplate: () => sectionCopy.weekNumber,
  tabHref: dashboardTabHref,
});

const {
  calendarSemesterHref,
  setCalendarMonth,
  setCalendarSemester,
  setCalendarView,
  setCalendarWeek,
  syncCalendarStateFromUrl,
} = createDashboardCalendarActions({
  getCalendarData: () => calendarData,
  getCalendarMonth: () => calendarMonth,
  getCalendarSemesterId: () => calendarSemesterId,
  getCalendarView: () => calendarView,
  getCalendarWeekStart: () => calendarWeekStart,
  replaceUrl: (href) => {
    window.history.replaceState({}, "", href);
  },
  setCalendarMonth: (value) => {
    calendarMonth = value;
  },
  setCalendarSemesterId: (value) => {
    calendarSemesterId = value;
  },
  setCalendarView: (value) => {
    calendarView = value;
  },
  setCalendarWeekStart: (value) => {
    calendarWeekStart = value;
  },
  tabHref: dashboardTabHref,
});

$: derivedState = buildDashboardControllerDerivedState({
  dashboardLinkGroupLabels,
  data,
  dateFallback: sectionCopy.dateTBD,
  examFilter,
  linkSearchQuery,
  notAvailable: dashboardCopy.notAvailable,
  currentDashboardLinkItems: dashboardLinkSourceItems,
  currentOverviewLinkItems: overviewLinkSourceItems,
  todoFilter,
});
$: anonymousData = derivedState.anonymousData;
$: homeworkItems = derivedState.homeworkItems;
$: signedData = applyLocalHomeworkItemsToSignedData(
  derivedState.signedData,
  homeworkItems,
);
$: homeworkReferenceDate = referenceDate(signedData?.referenceNow);
$: todoItems = derivedState.todoItems;
$: filteredTodos = derivedState.filteredTodos;
$: examRows = derivedState.examRows;
$: filteredExamRows = derivedState.filteredExamRows;
$: dashboardLinkItems = derivedState.dashboardLinkItems;
$: overviewLinkItems = derivedState.overviewLinkItems;
$: signedLinkGroups = derivedState.signedLinkGroups;
$: anonymousLinkGroups = derivedState.anonymousLinkGroups;
$: calendarData = derivedState.calendarData;
$: syncCalendarStateFromUrl($page.url, calendarData);
$: selectedImportSectionIdSet = new Set(selectedImportSectionIds);
$: selectedImportCount = selectedImportSectionIds.length;
$: canMatchImportSections =
  bulkImportText.trim().length > 0 && !isMatchingSections;

let mounted = false;

onMount(() => {
  mounted = true;
  return mountDashboardController({
    applyViewState: applyDashboardViewState,
    clearPendingRemoveSection,
    copy: {
      dashboard: dashboardCopy,
      subscriptions: subscriptionsCopy,
    },
    getLinkSearchInput: () => linkSearchInput,
    replaceState: (href) => {
      replaceState(href, {});
    },
    setBulkImportMessage: (value) => {
      bulkImportMessage = value;
    },
    setLinkActionError: (value) => {
      linkActionError = value;
    },
    setLinkReturnTo: (value) => {
      linkReturnTo = value;
    },
    setSubscriptionActionMessage: (value) => {
      subscriptionActionMessage = value;
    },
  });
});
</script>

<svelte:head>
  <title>{copy.metadata.home} - Life@USTC</title>
</svelte:head>

<div class="mx-auto grid w-full max-w-6xl gap-6">
  <DashboardStatusAlerts
    {actionError}
    {calendarCopyError}
    {calendarCopyMessage}
  />

  {#if signedData}
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
        {homeworkReferenceDate}
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
        {todoPriorityClass}
        {todoPriorityOptions}
        {todoSavingById}
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
  {:else if data.signedIn && data.userMissing}
    <Alert variant="warning">{commonCopy.userNotFound}</Alert>
  {:else if anonymousData?.tab === "bus" && !mounted}
    <div class="rounded-xl border border-base-300 bg-base-100 p-4 text-base-content/70 text-sm">
      {busCopy.empty}
    </div>
  {:else if anonymousData}
    <AnonymousDashboardView
      {busCopy}
      {dashboardCopy}
      anonymousData={anonymousData}
      anonymousLinkGroups={anonymousLinkGroups}
      {linkIconLabel}
      {linkView}
      {setLinkView}
      bind:linkSearchInput
      bind:linkSearchQuery
    />
  {/if}
</div>
