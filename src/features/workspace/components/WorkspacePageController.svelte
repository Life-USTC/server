<script lang="ts">
import { onMount } from "svelte";
import {
  addDays,
  addMonths,
  calendarEventParts,
  calendarEventsForDay,
  monthWeeks,
} from "@/features/workspace/lib/calendar";
import {
  calendarExamChipFields,
  calendarHomeworkChipFields,
  calendarSemesterIndex,
  calendarSessionChipFields,
} from "@/features/workspace/lib/calendar-display";
import { examTimeLabel } from "@/features/workspace/lib/exams";
import { namePrimary } from "@/features/workspace/lib/localized-names";
import {
  formatMessage,
  referenceDate,
} from "@/features/workspace/lib/overview";
import { todoPriorityOptions as buildTodoPriorityOptions } from "@/features/workspace/lib/todos";
import { createWorkspaceControllerDefaultState } from "@/features/workspace/lib/workspace-controller-default-state";
import {
  applyLocalHomeworkItemsToSignedData,
  applyLocalTodoItemsToSignedData,
  buildWorkspaceControllerDerivedState,
} from "@/features/workspace/lib/workspace-controller-derived-state";
import {
  buildCalendarWeekdayLabels,
  type CatalogLinkItem,
  isSignedWorkspaceData,
  type TodoItem,
  todoPriorityOrder,
  type WorkspaceActionData,
  type WorkspacePageData,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { linkIconLabel } from "@/features/workspace/lib/workspace-link-icon";
import { workspaceTabHref } from "@/features/workspace/lib/workspace-nav";
import { createWorkspacePageControllerActions } from "@/features/workspace/lib/workspace-page-controller-actions";
import { page } from "$app/stores";
import PageHeader from "$lib/components/PageHeader.svelte";
import * as Alert from "$lib/components/ui/alert/index.js";
import SignedWorkspaceOverviewBranch from "./SignedWorkspaceOverviewBranch.svelte";
import SignedWorkspacePublicTabs from "./SignedWorkspacePublicTabs.svelte";
import SignedWorkspaceSubscriptionsBranch from "./SignedWorkspaceSubscriptionsBranch.svelte";
import SignedWorkspaceTaskTabs from "./SignedWorkspaceTaskTabs.svelte";
import type { WorkspaceSubscriptionsTabProps } from "./subscription-tab-types";
import type { WorkspaceCalendarTabProps } from "./workspace-calendar-component-types";

type PageData = WorkspacePageData;
type ActionData = WorkspaceActionData;

export let data: PageData;
export let form: ActionData | undefined = undefined;

let {
  bulkImportError,
  bulkImportMessage,
  bulkImportSemesterId,
  bulkImportText,
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
  catalogLinkItems,
  editTodoError,
  editingTodo,
  examFilter,
  examRows,
  examView,
  filteredExamRows,
  filteredTodos,
  homeworkActionError,
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
  removingSectionId,
  selectedHomework,
  selectedImportSectionIds,
  selectedTodo,
  showCreateHomework,
  showCreateTodo,
  signedData,
  signedLinkGroups,
  subscriptionActionError,
  todoActionError,
  todoFilter,
  todoItems,
  todoSavingById,
  todoView,
  unmatchedSectionCodes,
  updatingCatalogLinkSlug,
} = createWorkspaceControllerDefaultState();
let catalogLinkSourceItems: CatalogLinkItem[] = [];
let overviewLinkSourceItems: CatalogLinkItem[] = [];
let todoSourceItems: TodoItem[] = [];
let linkSourceData: PageData | null = null;
$: copy = data.copy;
$: actionError = form?.error ?? "";
$: commonCopy = copy.common;
$: workspaceCopy = copy.workspace;
$: busCopy = copy.bus;
$: homeworksCopy = copy.homeworks;
$: homeworkCopy = copy.myHomeworks;
$: sectionCopy = copy.sectionDetail;
$: subscriptionsCopy = copy.subscriptions;
$: todosCopy = copy.todos;
$: commentsCopy = copy.comments;
$: pageTitle =
  data.signedIn && data.mainContentLabel
    ? data.mainContentLabel
    : copy.metadata.home;
$: todoPriorityOptions = buildTodoPriorityOptions(todoPriorityOrder, todosCopy);
$: calendarWeekdayLabels = buildCalendarWeekdayLabels(sectionCopy);
$: catalogLinkGroupLabels = workspaceCopy.linkHub.groups;
$: if (data !== linkSourceData) {
  const signedPageData = isSignedWorkspaceData(data) ? data : null;
  catalogLinkSourceItems = signedPageData?.links?.catalogLinks ?? [];
  overviewLinkSourceItems =
    signedPageData?.overview?.overviewLinks.slice(0, 4) ?? [];
  todoSourceItems = signedPageData?.todos ?? [];
  linkSourceData = data;
}

const {
  applyHomeworkDueAtSemesterEnd,
  applyHomeworkDueInMonth,
  applyHomeworkDueInWeek,
  applyHomeworkStartNow,
  calendarHomeworkHref,
  calendarTimelineItemsForDay,
  calendarTodoChipFields,
  calendarWeekLabel,
  confirmImportSections,
  createHomeworkAction,
  createTodoAction,
  deleteTodo,
  examMetadataLabels,
  matchImportSections,
  mount,
  nameSecondary,
  openBulkImportDialog,
  openCreateHomeworkDialog,
  openTodoEditor,
  removeSubscribedSection,
  resetBulkImport,
  searchQuickAddSections,
  selectedCreateHomeworkSection,
  sessionHref,
  setCalendarMonth,
  setCalendarSemester,
  setCalendarView,
  setCalendarWeek,
  submitWorkspaceLinkPin,
  subscribeQuickAddSections,
  syncCalendarStateFromUrl,
  toggleHomeworkCompletion,
  toggleImportSectionSelection,
  toggleTodoCompletion,
  updateTodoAction,
} = createWorkspacePageControllerActions({
  getBulkImportSemesterId: () => bulkImportSemesterId,
  getBulkImportText: () => bulkImportText,
  getCalendarData: () => calendarData,
  getCalendarMonth: () => calendarMonth,
  getCalendarSemesterId: () => calendarSemesterId,
  getCalendarView: () => calendarView,
  getCalendarWeekStart: () => calendarWeekStart,
  getCatalogLinkSourceItems: () => catalogLinkSourceItems,
  getCopy: () => copy,
  getCreateHomeworkSectionId: () => createHomeworkSectionId,
  getData: () => data,
  getEditingTodo: () => editingTodo,
  getHomeworkItems: () => homeworkItems,
  getHomeworkSavingById: () => homeworkSavingById,
  getLinkReturnTo: () => linkReturnTo,
  getLinkSearchInput: () => linkSearchInput,
  getOverviewLinkSourceItems: () => overviewLinkSourceItems,
  getSelectedHomework: () => selectedHomework,
  getSelectedImportSectionIds: () => selectedImportSectionIds,
  getSelectedTodo: () => selectedTodo,
  getSignedData: () => signedData,
  getTodoSavingById: () => todoSavingById,
  getTodoSourceItems: () => todoSourceItems,
  getUpdatingCatalogLinkSlug: () => updatingCatalogLinkSlug,
  setBulkImportError: (v) => {
    bulkImportError = v;
  },
  setBulkImportMessage: (v) => {
    bulkImportMessage = v;
  },
  setBulkImportOpen: (v) => {
    isBulkImportOpen = v;
  },
  setBulkImportSemesterId: (v) => {
    bulkImportSemesterId = v;
  },
  setBulkImportText: (v) => {
    bulkImportText = v;
  },
  setCalendarMonth: (v) => {
    calendarMonth = v;
  },
  setCalendarSemesterId: (v) => {
    calendarSemesterId = v;
  },
  setCalendarView: (v) => {
    calendarView = v;
  },
  setCalendarWeekStart: (v) => {
    calendarWeekStart = v;
  },
  setCatalogLinkSourceItems: (v) => {
    catalogLinkSourceItems = v;
  },
  setConfirmImportOpen: (v) => {
    isConfirmImportOpen = v;
  },
  setCreateHomeworkAdvancedOpen: (v) => {
    createHomeworkAdvancedOpen = v;
  },
  setCreateHomeworkError: (v) => {
    createHomeworkError = v;
  },
  setCreateHomeworkPublishedAt: (v) => {
    createHomeworkPublishedAt = v;
  },
  setCreateHomeworkSectionId: (v) => {
    createHomeworkSectionId = v;
  },
  setCreateHomeworkSubmissionDueAt: (v) => {
    createHomeworkSubmissionDueAt = v;
  },
  setCreateHomeworkSubmissionStartAt: (v) => {
    createHomeworkSubmissionStartAt = v;
  },
  setCreateTodoError: (v) => {
    createTodoError = v;
  },
  setCreatingHomework: (v) => {
    isCreatingHomework = v;
  },
  setCreatingTodo: (v) => {
    isCreatingTodo = v;
  },
  setEditTodoError: (v) => {
    editTodoError = v;
  },
  setEditingTodo: (v) => {
    editingTodo = v;
  },
  setExamView: (v) => {
    examView = v;
  },
  setHomeworkActionError: (v) => {
    homeworkActionError = v;
  },
  setHomeworkItems: (v) => {
    homeworkItems = v;
  },
  setHomeworkSavingById: (v) => {
    homeworkSavingById = v;
  },
  setHomeworkView: (v) => {
    homeworkView = v;
  },
  setImportingSections: (v) => {
    isImportingSections = v;
  },
  setLinkActionError: (v) => {
    linkActionError = v;
  },
  setLinkReturnTo: (v) => {
    linkReturnTo = v;
  },
  setLinkView: (v) => {
    linkView = v;
  },
  setMatchedSections: (v) => {
    matchedSections = v;
  },
  setMatchingSections: (v) => {
    isMatchingSections = v;
  },
  setOverviewLinkSourceItems: (v) => {
    overviewLinkSourceItems = v;
  },
  setRemovingSectionId: (v) => {
    removingSectionId = v;
  },
  setSelectedHomework: (v) => {
    selectedHomework = v;
  },
  setSelectedImportSectionIds: (v) => {
    selectedImportSectionIds = v;
  },
  setSelectedTodo: (v) => {
    selectedTodo = v;
  },
  setShowCreateHomework: (v) => {
    showCreateHomework = v;
  },
  setShowCreateTodo: (v) => {
    showCreateTodo = v;
  },
  setSubscriptionActionError: (v) => {
    subscriptionActionError = v;
  },
  setTodoActionError: (v) => {
    todoActionError = v;
  },
  setTodoSavingById: (v) => {
    todoSavingById = v;
  },
  setTodoSourceItems: (v) => {
    todoSourceItems = v;
  },
  setTodoView: (v) => {
    todoView = v;
  },
  setUnmatchedSectionCodes: (v) => {
    unmatchedSectionCodes = v;
  },
  setUpdatingCatalogLinkSlug: (v) => {
    updatingCatalogLinkSlug = v;
  },
  setUpdatingTodo: (v) => {
    isUpdatingTodo = v;
  },
});

$: derivedState = buildWorkspaceControllerDerivedState({
  catalogLinkGroupLabels,
  data,
  dateFallback: sectionCopy.dateTBD,
  examFilter,
  linkSearchQuery,
  notAvailable: workspaceCopy.notAvailable,
  currentCatalogLinkItems: catalogLinkSourceItems,
  currentOverviewLinkItems: overviewLinkSourceItems,
  currentTodoItems: todoSourceItems,
  todoFilter,
});
$: homeworkItems = derivedState.homeworkItems;
$: signedData = applyLocalTodoItemsToSignedData(
  applyLocalHomeworkItemsToSignedData(derivedState.signedData, homeworkItems),
  todoSourceItems,
);
$: homeworkReferenceDate = referenceDate(signedData?.referenceNow);
$: todoItems = derivedState.todoItems;
$: filteredTodos = derivedState.filteredTodos;
$: examRows = derivedState.examRows;
$: filteredExamRows = derivedState.filteredExamRows;
$: catalogLinkItems = derivedState.catalogLinkItems;
$: overviewLinkItems = derivedState.overviewLinkItems;
$: signedLinkGroups = derivedState.signedLinkGroups;
$: calendarData = derivedState.calendarData;
$: syncCalendarStateFromUrl($page.url, calendarData);
$: selectedImportSectionIdSet = new Set(selectedImportSectionIds);
$: canMatchImportSections =
  bulkImportText.trim().length > 0 && !isMatchingSections;

onMount(mount);
</script>

<svelte:head>
  <title>{pageTitle} - Life@USTC</title>
</svelte:head>

<div class="page-frame">
  <div class="grid w-full gap-6">
    {#if data.signedIn && data.mainContentLabel}
      <PageHeader
        class="py-0 md:py-1"
        title={data.mainContentLabel}
        titleClass="text-xl sm:text-2xl"
      />
    {/if}

    {#if actionError}
      <Alert.Root variant="destructive">
        <Alert.Description>{actionError}</Alert.Description>
      </Alert.Root>
    {/if}

    {#if signedData}
      {#if signedData.tab === "overview"}
        <SignedWorkspaceOverviewBranch
        {calendarTimelineItemsForDay}
        {commonCopy}
        {copy}
        {workspaceCopy}
        {workspaceTabHref}
        {data}
        {linkIconLabel}
        {overviewLinkItems}
        {sectionCopy}
        {subscriptionsCopy}
        {signedData}
        {submitWorkspaceLinkPin}
        {todosCopy}
        {updatingCatalogLinkSlug}
        />
      {:else if signedData.tab === "todos" || signedData.tab === "homeworks" || signedData.tab === "exams"}
        <SignedWorkspaceTaskTabs
        activeTab={signedData.tab}
        {applyHomeworkDueAtSemesterEnd}
        {applyHomeworkDueInMonth}
        {applyHomeworkDueInWeek}
        {applyHomeworkStartNow}
        {commentsCopy}
        {commonCopy}
        {createHomeworkAction}
        {createTodoAction}
        {workspaceCopy}
        {workspaceTabHref}
        {data}
        {deleteTodo}
        {examMetadataLabels}
        {examRows}
        {examTimeLabel}
        {filteredExamRows}
        {filteredTodos}
        {homeworkActionError}
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
        {signedData}
        {subscriptionsCopy}
        {todoActionError}
        {todoItems}
        {todoPriorityOptions}
        {todoSavingById}
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
        bind:isCreatingHomework
        bind:selectedHomework
        bind:selectedTodo
        bind:showCreateHomework
        bind:showCreateTodo
        bind:todoFilter
        />
      {:else if signedData.tab === "subscriptions" && signedData.subscriptions}
        {@const subscriptionsSignedData = signedData as WorkspaceSubscriptionsTabProps["signedData"]}
        <SignedWorkspaceSubscriptionsBranch
        {workspaceCopy}
        {sectionCopy}
        {subscriptionsCopy}
        signedData={subscriptionsSignedData}
        {selectedImportSectionIdSet}
        {canMatchImportSections}
        {formatMessage}
        {namePrimary}
        {nameSecondary}
        {resetBulkImport}
        {searchQuickAddSections}
        {openBulkImportDialog}
        {subscribeQuickAddSections}
        {toggleImportSectionSelection}
        {matchImportSections}
        {confirmImportSections}
        {removeSubscribedSection}
        {bulkImportMessage}
        {bulkImportError}
        {isMatchingSections}
        {isImportingSections}
        {removingSectionId}
        {subscriptionActionError}
        {matchedSections}
        {unmatchedSectionCodes}
        bind:isBulkImportOpen
        bind:isConfirmImportOpen
        bind:bulkImportSemesterId
        bind:bulkImportText
        />
      {:else}
        {@const calendarSignedData = signedData as WorkspaceCalendarTabProps["signedData"]}
        <SignedWorkspacePublicTabs
        {copy}
        {commonCopy}
        {busCopy}
        {workspaceCopy}
        {sectionCopy}
        {subscriptionsCopy}
        {calendarWeekdayLabels}
        signedData={calendarSignedData}
        {workspaceTabHref}
        {formatMessage}
        {sessionHref}
        {setCalendarView}
        {setCalendarMonth}
        {setCalendarWeek}
        {setCalendarSemester}
        {addDays}
        {addMonths}
        {monthWeeks}
        {calendarEventsForDay}
        {calendarTimelineItemsForDay}
        {calendarWeekLabel}
        {calendarEventParts}
        {calendarHomeworkHref}
        {calendarSessionChipFields}
        {calendarExamChipFields}
        {calendarHomeworkChipFields}
        {calendarTodoChipFields}
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
        {signedLinkGroups}
        {submitWorkspaceLinkPin}
        {updatingCatalogLinkSlug}
        />
      {/if}
    {:else if data.signedIn && data.userMissing}
      <Alert.Root>
        <Alert.Description>{commonCopy.userNotFound}</Alert.Description>
      </Alert.Root>
    {/if}
  </div>
</div>
