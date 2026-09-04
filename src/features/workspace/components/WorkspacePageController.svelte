<script lang="ts">
import { onMount } from "svelte";
import { toast } from "svelte-sonner";
import {
  addDays,
  addMonths,
  calendarEventParts,
  calendarEventsForDay,
  monthWeeks,
  weekDaysFor,
} from "@/features/workspace/lib/calendar";
import {
  calendarExamChipFields,
  calendarHomeworkChipFields,
  calendarSemesterIndex,
  calendarSessionChipFields,
} from "@/features/workspace/lib/calendar-display";
import {
  examReferenceNow,
  examTimeLabel,
} from "@/features/workspace/lib/exams";
import { namePrimary } from "@/features/workspace/lib/localized-names";
import {
  dayStart,
  fmtTime,
  formatMessage,
  referenceDate,
} from "@/features/workspace/lib/overview";
import { todoPriorityOptions as buildTodoPriorityOptions } from "@/features/workspace/lib/todos";
import { createWorkspaceCalendarActions } from "@/features/workspace/lib/workspace-controller-calendar-actions";
import { createWorkspaceCalendarDisplayActions } from "@/features/workspace/lib/workspace-controller-calendar-display-actions";
import { createWorkspaceCreateHomeworkActions } from "@/features/workspace/lib/workspace-controller-create-homework-actions";
import { createWorkspaceControllerDefaultState } from "@/features/workspace/lib/workspace-controller-default-state";
import {
  applyLocalHomeworkItemsToSignedData,
  applyLocalTodoItemsToSignedData,
  buildWorkspaceControllerDerivedState,
} from "@/features/workspace/lib/workspace-controller-derived-state";
import { createWorkspaceDisplayActions } from "@/features/workspace/lib/workspace-controller-display-actions";
import { createWorkspaceFormSubmitActions } from "@/features/workspace/lib/workspace-controller-form-actions";
import {
  buildCalendarWeekdayLabels,
  type CatalogLinkItem,
  isSignedWorkspaceData,
  type TodoItem,
  todoPriorityOrder,
  type WorkspaceActionData,
  type WorkspacePageData,
  type WorkspaceViewState,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { createWorkspaceHomeworkStateActions } from "@/features/workspace/lib/workspace-controller-homework-state-actions";
import { createWorkspaceLinkStateActions } from "@/features/workspace/lib/workspace-controller-link-state-actions";
import { mountWorkspaceController } from "@/features/workspace/lib/workspace-controller-mount";
import { createWorkspaceSubscriptionActions } from "@/features/workspace/lib/workspace-controller-subscription-actions";
import { createWorkspaceTodoActions } from "@/features/workspace/lib/workspace-controller-todo-actions";
import { linkIconLabel } from "@/features/workspace/lib/workspace-link-icon";
import { workspaceTabHref } from "@/features/workspace/lib/workspace-nav";
import { goto, invalidateAll, replaceState } from "$app/navigation";
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

function openTodoEditor(todo: TodoItem) {
  selectedTodo = null;
  editTodoError = "";
  editingTodo = todo;
}

const {
  applyHomeworkDueAtSemesterEnd,
  applyHomeworkDueInMonth,
  applyHomeworkDueInWeek,
  applyHomeworkStartNow,
  openCreateHomeworkDialog,
  selectedCreateHomeworkSection,
} = createWorkspaceCreateHomeworkActions({
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

const { deleteTodo, toggleTodoCompletion } = createWorkspaceTodoActions({
  getEditingTodo: () => editingTodo,
  getSelectedTodo: () => selectedTodo,
  getTodoItems: () => todoSourceItems,
  getTodoSavingById: () => todoSavingById,
  getTodosCopy: () => todosCopy,
  onSuccess: (action) => {
    toast.success(
      action === "delete"
        ? todosCopy.deleteSuccess
        : action === "complete"
          ? todosCopy.completeSuccess
          : todosCopy.uncompleteSuccess,
    );
  },
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
    todoSourceItems = value;
  },
  setTodoSavingById: (value) => {
    todoSavingById = value;
  },
});

const { examMetadataLabels, nameSecondary } = createWorkspaceDisplayActions({
  getCountLabel: () => sectionCopy.examCount,
  getFinalLabel: () => sectionCopy.examTypeFinal,
  getLocale: () => data.locale as "en-us" | "zh-cn",
  getMidtermLabel: () => sectionCopy.examTypeMidterm,
});

const { createHomeworkAction, createTodoAction, updateTodoAction } =
  createWorkspaceFormSubmitActions({
    getHomeworksCopy: () => homeworksCopy,
    getTodosCopy: () => todosCopy,
    onSuccess: (action) => {
      toast.success(
        String(
          action === "createHomework"
            ? homeworksCopy.createSuccess
            : action === "createTodo"
              ? todosCopy.createSuccess
              : todosCopy.updateSuccess,
        ),
      );
    },
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
    setEditingTodo: (value) => {
      editingTodo = value;
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
  searchQuickAddSections,
  subscribeQuickAddSections,
  toggleImportSectionSelection,
} = createWorkspaceSubscriptionActions({
  getBulkImportSemesterId: () => bulkImportSemesterId,
  getBulkImportText: () => bulkImportText,
  getCurrentSemesterId: () =>
    signedData?.subscriptions?.currentSemesterId ?? null,
  getSelectedImportSectionIds: () => selectedImportSectionIds,
  getSubscriptionsCopy: () => subscriptionsCopy,
  invalidateAll,
  onSuccess: (message) => {
    toast.success(message);
  },
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
  setRemovingSectionId: (value) => {
    removingSectionId = value;
  },
  setSelectedImportSectionIds: (value) => {
    selectedImportSectionIds = value;
  },
  setSubscriptionActionError: (value) => {
    subscriptionActionError = value;
  },
  setUnmatchedSectionCodes: (value) => {
    unmatchedSectionCodes = value;
  },
});

function applyWorkspaceViewState(state: WorkspaceViewState) {
  homeworkView = state.homeworkView;
  todoView = state.todoView;
  examView = state.examView;
  linkView = state.linkView;
}
const { toggleHomeworkCompletion } = createWorkspaceHomeworkStateActions({
  getHomeworkItems: () => homeworkItems,
  getHomeworkSavingById: () => homeworkSavingById,
  getHomeworksCopy: () => homeworksCopy,
  getSelectedHomework: () => selectedHomework,
  onSuccess: (action) => {
    toast.success(
      action === "complete"
        ? homeworksCopy.markComplete
        : homeworksCopy.markIncomplete,
    );
  },
  setHomeworkActionError: (value) => {
    homeworkActionError = value;
  },
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

const { submitWorkspaceLinkPin } = createWorkspaceLinkStateActions({
  applyWorkspaceViewState,
  getWorkspaceCopy: () => workspaceCopy,
  getCatalogLinkItems: () => catalogLinkSourceItems,
  getLinkReturnTo: () => linkReturnTo,
  getOverviewLinkItems: () => overviewLinkSourceItems,
  getUpdatingCatalogLinkSlug: () => updatingCatalogLinkSlug,
  onSuccess: (action) => {
    toast.success(
      action === "pin"
        ? workspaceCopy.linkHub.pin
        : workspaceCopy.linkHub.unpin,
    );
  },
  replaceState: (href) => {
    replaceState(href, {});
  },
  setCatalogLinkItems: (value) => {
    catalogLinkSourceItems = value;
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
  setUpdatingCatalogLinkSlug: (value) => {
    updatingCatalogLinkSlug = value;
  },
});

const {
  calendarHomeworkHref,
  calendarTimelineItemsForDay,
  calendarTodoChipFields,
  calendarWeekLabel,
  sessionHref,
} = createWorkspaceCalendarDisplayActions({
  getCommonCourseLabel: () => commonCopy.courses,
  getEventLabels: () => ({
    exam: copy.CalendarEventCard.exam,
    homework: copy.CalendarEventCard.homework,
    todo: copy.CalendarEventCard.todo,
  }),
  getTodoPriorityLabel: (priority) => todosCopy.priority[priority],
  getWeekNumberTemplate: () => sectionCopy.weekNumber,
  tabHref: workspaceTabHref,
});

const {
  calendarSemesterHref,
  setCalendarMonth,
  setCalendarSemester,
  setCalendarView,
  setCalendarWeek,
  syncCalendarStateFromUrl,
} = createWorkspaceCalendarActions({
  getCalendarData: () => calendarData,
  getCalendarMonth: () => calendarMonth,
  getCalendarSemesterId: () => calendarSemesterId,
  getCalendarView: () => calendarView,
  getCalendarWeekStart: () => calendarWeekStart,
  navigateUrl: (href) => {
    void goto(href, { noScroll: true, replaceState: true });
  },
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
  tabHref: workspaceTabHref,
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

onMount(() => {
  return mountWorkspaceController({
    applyViewState: applyWorkspaceViewState,
    clearPendingRemoveSection,
    copy: {
      workspace: workspaceCopy,
    },
    getLinkSearchInput: () => linkSearchInput,
    replaceState: (href) => {
      replaceState(href, {});
    },
    setLinkActionError: (value) => {
      linkActionError = value;
    },
    setLinkReturnTo: (value) => {
      linkReturnTo = value;
    },
  });
});
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
