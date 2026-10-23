<script lang="ts">
import { onMount, untrack } from "svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import {
  addDays,
  addMonths,
  calendarEventParts,
  calendarEventsForDay,
  monthWeeks,
} from "@/features/workspace/lib/calendar";
import {
  calendarHomeworkChipFields as buildCalendarHomeworkChipFields,
  calendarExamChipFields,
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
import { page as routePage } from "$app/state";
import SignedWorkspacePublicTabs from "./SignedWorkspacePublicTabs.svelte";
import SignedWorkspaceSubscriptionsBranch from "./SignedWorkspaceSubscriptionsBranch.svelte";
import SignedWorkspaceTaskTabs from "./SignedWorkspaceTaskTabs.svelte";
import type { WorkspaceSubscriptionsTabProps } from "./subscription-tab-types";
import type { WorkspaceCalendarTabProps } from "./workspace-calendar-component-types";

type PageData = WorkspacePageData;
type ActionData = WorkspaceActionData;

interface Props {
  data: PageData;
  form?: ActionData | undefined;
}

let { data, form = undefined }: Props = $props();

let {
  bulkImportError,
  bulkImportMessage,
  bulkImportSemesterId,
  bulkImportText,
  calendarDay,
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
  editTodoError,
  editingTodo,
  examFilter,
  examView,
  homeworkActionError,
  homeworkFilter,
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
  linkSearchQuery,
  linkView,
  matchedSections,
  removingSectionId,
  selectedHomework,
  selectedImportSectionIds,
  selectedTodo,
  showCreateHomework,
  showCreateTodo,
  subscriptionActionError,
  todoActionError,
  todoFilter,
  todoSavingById,
  todoView,
  unmatchedSectionCodes,
  updatingCatalogLinkSlug,
} = $state(createWorkspaceControllerDefaultState());
let catalogLinkSourceItems: CatalogLinkItem[] = $derived(
  isSignedWorkspaceData(data) ? (data.links?.catalogLinks ?? []) : [],
);
let todoSourceItems: TodoItem[] = $derived(
  isSignedWorkspaceData(data) ? (data.todos ?? []) : [],
);
let copy = $derived(data.copy);
let actionError = $derived(form?.error ?? "");
let commonCopy = $derived(copy.common);
let workspaceCopy = $derived(copy.workspace);
let busCopy = $derived(copy.bus);
let homeworksCopy = $derived(copy.homeworks);
let homeworkCopy = $derived(copy.myHomeworks);
let sectionCopy = $derived(copy.sectionDetail);
let subscriptionsCopy = $derived(copy.subscriptions);
let todosCopy = $derived(copy.todos);
let commentsCopy = $derived(copy.comments);
let pageTitle = $derived(
  data.signedIn && data.mainContentLabel
    ? data.mainContentLabel
    : copy.metadata.home,
);
let todoPriorityOptions = $derived(
  buildTodoPriorityOptions(todoPriorityOrder, todosCopy),
);

function calendarHomeworkChipFields(
  homework: Parameters<typeof buildCalendarHomeworkChipFields>[0],
) {
  return buildCalendarHomeworkChipFields(
    homework,
    homeworksCopy.noCompletionRequired,
  );
}
let calendarWeekdayLabels = $derived(buildCalendarWeekdayLabels(sectionCopy));
let catalogLinkGroupLabels = $derived(workspaceCopy.linkHub.groups);

const {
  applyHomeworkDueAtSemesterEnd,
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
  sessionHref,
  setCalendarDay,
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
  getCalendarDay: () => calendarDay,
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
  setCalendarDay: (v) => {
    calendarDay = v;
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

let derivedState = $derived(
  buildWorkspaceControllerDerivedState({
    catalogLinkGroupLabels,
    data,
    dateFallback: sectionCopy.dateTBD,
    examFilter,
    linkSearchQuery,
    notAvailable: workspaceCopy.notAvailable,
    currentCatalogLinkItems: catalogLinkSourceItems,
    currentTodoItems: todoSourceItems,
    todoFilter,
  }),
);
let homeworkItems = $derived(derivedState.homeworkItems);
let signedData = $derived(
  applyLocalTodoItemsToSignedData(
    applyLocalHomeworkItemsToSignedData(derivedState.signedData, homeworkItems),
    todoSourceItems,
  ),
);
let homeworkReferenceDate = $derived(referenceDate(signedData?.referenceNow));
let filteredTodos = $derived(derivedState.filteredTodos);
let examRows = $derived(derivedState.examRows);
let filteredExamRows = $derived(derivedState.filteredExamRows);
let catalogLinkItems = $derived(derivedState.catalogLinkItems);
let signedLinkGroups = $derived(derivedState.signedLinkGroups);
let calendarData = $derived(derivedState.calendarData);
untrack(() =>
  syncCalendarStateFromUrl(new URL(routePage.url.href), calendarData),
);
$effect.pre(() => {
  syncCalendarStateFromUrl(new URL(routePage.url.href), calendarData);
});
let selectedImportSectionIdSet = $derived(new Set(selectedImportSectionIds));
let canMatchImportSections = $derived(
  bulkImportSemesterId !== "" &&
    bulkImportText.trim().length > 0 &&
    !isMatchingSections,
);

onMount(mount);
</script>

<svelte:head><title>{pageTitle} - Life@USTC</title></svelte:head>

<CollectionPage density="compact" panel={false} title={data.signedIn && data.mainContentLabel ? data.mainContentLabel : undefined}>

  {#if actionError}
    <Alert.Root variant="destructive">
      <Alert.Description>{actionError}</Alert.Description>
    </Alert.Root>
  {/if}

  {#if signedData}
    {#if signedData.tab === "todos" || signedData.tab === "homeworks" || signedData.tab === "exams"}
      <SignedWorkspaceTaskTabs
        activeTab={signedData.tab}
        applyHomeworkDueAtSemesterEnd={applyHomeworkDueAtSemesterEnd}
        applyHomeworkStartNow={applyHomeworkStartNow}
        commentsCopy={commentsCopy}
        commonCopy={commonCopy}
        createHomeworkAction={createHomeworkAction}
        createTodoAction={createTodoAction}
        workspaceCopy={workspaceCopy}
        workspaceTabHref={workspaceTabHref}
        data={data}
        deleteTodo={deleteTodo}
        examMetadataLabels={examMetadataLabels}
        examRows={examRows}
        examTimeLabel={examTimeLabel}
        filteredExamRows={filteredExamRows}
        filteredTodos={filteredTodos}
        homeworkActionError={homeworkActionError}
        homeworkCopy={homeworkCopy}
        homeworkReferenceDate={homeworkReferenceDate}
        homeworksCopy={homeworksCopy}
        isCreatingTodo={isCreatingTodo}
        isUpdatingTodo={isUpdatingTodo}
        namePrimary={namePrimary}
        openCreateHomeworkDialog={openCreateHomeworkDialog}
        openTodoEditor={openTodoEditor}
        sectionCopy={sectionCopy}
        signedData={signedData}
        subscriptionsCopy={subscriptionsCopy}
        todoActionError={todoActionError}
        todoPriorityOptions={todoPriorityOptions}
        todoSavingById={todoSavingById}
        todosCopy={todosCopy}
        toggleHomeworkCompletion={toggleHomeworkCompletion}
        toggleTodoCompletion={toggleTodoCompletion}
        updateTodoAction={updateTodoAction}
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
        workspaceCopy={workspaceCopy}
        sectionCopy={sectionCopy}
        subscriptionsCopy={subscriptionsCopy}
        signedData={subscriptionsSignedData}
        selectedImportSectionIdSet={selectedImportSectionIdSet}
        canMatchImportSections={canMatchImportSections}
        formatMessage={formatMessage}
        namePrimary={namePrimary}
        nameSecondary={nameSecondary}
        resetBulkImport={resetBulkImport}
        searchQuickAddSections={searchQuickAddSections}
        openBulkImportDialog={openBulkImportDialog}
        subscribeQuickAddSections={subscribeQuickAddSections}
        toggleImportSectionSelection={toggleImportSectionSelection}
        matchImportSections={matchImportSections}
        confirmImportSections={confirmImportSections}
        removeSubscribedSection={removeSubscribedSection}
        bulkImportMessage={bulkImportMessage}
        bulkImportError={bulkImportError}
        isMatchingSections={isMatchingSections}
        isImportingSections={isImportingSections}
        removingSectionId={removingSectionId}
        subscriptionActionError={subscriptionActionError}
        matchedSections={matchedSections}
        unmatchedSectionCodes={unmatchedSectionCodes}
        bind:isBulkImportOpen
        bind:isConfirmImportOpen
        bind:bulkImportSemesterId
        bind:bulkImportText
      />
    {:else}
      {@const calendarSignedData = signedData as WorkspaceCalendarTabProps["signedData"]}
      <SignedWorkspacePublicTabs
        copy={copy}
        commonCopy={commonCopy}
        busCopy={busCopy}
        workspaceCopy={workspaceCopy}
        sectionCopy={sectionCopy}
        subscriptionsCopy={subscriptionsCopy}
        calendarWeekdayLabels={calendarWeekdayLabels}
        signedData={calendarSignedData}
        workspaceTabHref={workspaceTabHref}
        formatMessage={formatMessage}
        sessionHref={sessionHref}
        setCalendarView={setCalendarView}
        setCalendarDay={setCalendarDay}
        setCalendarMonth={setCalendarMonth}
        setCalendarWeek={setCalendarWeek}
        setCalendarSemester={setCalendarSemester}
        addDays={addDays}
        addMonths={addMonths}
        monthWeeks={monthWeeks}
        calendarEventsForDay={calendarEventsForDay}
        calendarTimelineItemsForDay={calendarTimelineItemsForDay}
        calendarWeekLabel={calendarWeekLabel}
        calendarEventParts={calendarEventParts}
        calendarHomeworkHref={calendarHomeworkHref}
        calendarSessionChipFields={calendarSessionChipFields}
        calendarExamChipFields={calendarExamChipFields}
        calendarHomeworkChipFields={calendarHomeworkChipFields}
        calendarTodoChipFields={calendarTodoChipFields}
        calendarSemesterIndex={calendarSemesterIndex}
        calendarView={calendarView}
        calendarDay={calendarDay}
        calendarMonth={calendarMonth}
        calendarWeekStart={calendarWeekStart}
        calendarSemesterId={calendarSemesterId}
        calendarData={calendarData}
        linkActionError={linkActionError}
        linkIconLabel={linkIconLabel}
        linkReturnTo={linkReturnTo}
        bind:linkSearchQuery
        signedLinkGroups={signedLinkGroups}
        submitWorkspaceLinkPin={submitWorkspaceLinkPin}
        updatingCatalogLinkSlug={updatingCatalogLinkSlug}
      />
    {/if}
  {:else if data.signedIn && data.userMissing}
    <Alert.Root>
      <Alert.Description>{commonCopy.userNotFound}</Alert.Description>
    </Alert.Root>
  {/if}
</CollectionPage>
