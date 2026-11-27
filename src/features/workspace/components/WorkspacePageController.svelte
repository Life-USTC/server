<script lang="ts">
import { onMount, untrack } from "svelte";
import CollectionPage from "#lib/components/CollectionPage.svelte";
import * as Alert from "#lib/components/ui/alert/index.js";
import CommentsPanel from "@/features/comments/components/CommentsPanel.svelte";
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
import BusTab from "./BusTab.svelte";
import CalendarTab from "./CalendarTab.svelte";
import ExamsTab from "./ExamsTab.svelte";
import HomeworksTab from "./HomeworksTab.svelte";
import LinksTab from "./LinksTab.svelte";
import SubscriptionsTab from "./SubscriptionsTab.svelte";
import type { WorkspaceSubscriptionsTabProps } from "./subscription-tab-types";
import TodosTab from "./TodosTab.svelte";
import type { WorkspaceCalendarTabProps } from "./workspace-calendar-component-types";

type PageData = WorkspacePageData;
type ActionData = WorkspaceActionData;

interface Props {
  data: PageData;
  form?: ActionData | undefined;
}

let { data, form = undefined }: Props = $props();

const state = $state(createWorkspaceControllerDefaultState());
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
  state,
  getCalendarData: () => calendarData,
  getCatalogLinkSourceItems: () => catalogLinkSourceItems,
  getCopy: () => copy,
  getData: () => data,
  getHomeworkItems: () => homeworkItems,
  getSignedData: () => signedData,
  getTodoSourceItems: () => todoSourceItems,
  setCatalogLinkSourceItems: (v) => {
    catalogLinkSourceItems = v;
  },
  setHomeworkItems: (v) => {
    homeworkItems = v;
  },
  setTodoSourceItems: (v) => {
    todoSourceItems = v;
  },
});

let derivedState = $derived(
  buildWorkspaceControllerDerivedState({
    catalogLinkGroupLabels,
    data,
    dateFallback: sectionCopy.dateTBD,
    linkSearchQuery: state.linkSearchQuery,
    notAvailable: workspaceCopy.notAvailable,
    currentCatalogLinkItems: catalogLinkSourceItems,
    currentTodoItems: todoSourceItems,
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
let examRows = $derived(derivedState.examRows);
let catalogLinkItems = $derived(derivedState.catalogLinkItems);
let signedLinkGroups = $derived(derivedState.signedLinkGroups);
let calendarData = $derived(derivedState.calendarData);
untrack(() =>
  syncCalendarStateFromUrl(new URL(routePage.url.href), calendarData),
);
$effect.pre(() => {
  syncCalendarStateFromUrl(new URL(routePage.url.href), calendarData);
});
let selectedImportSectionIdSet = $derived(
  new Set(state.selectedImportSectionIds),
);
let canMatchImportSections = $derived(
  state.bulkImportSemesterId !== "" &&
    state.bulkImportText.trim().length > 0 &&
    !state.isMatchingSections,
);

onMount(mount);
</script>

<svelte:head><title>{pageTitle} - Life@USTC</title></svelte:head>

<CollectionPage density="compact" panel={false} title={data.signedIn && data.mainContentLabel ? data.mainContentLabel : undefined}>

  {#if actionError}
    <Alert.Message variant="destructive">{actionError}</Alert.Message>
  {/if}

  {#if signedData}
    {#if signedData.tab === "todos"}
      <TodosTab
        readOnlyReason={signedData.demo?.readOnlyReason}
        hasTodoItems={(signedData.todos?.length ?? 0) > 0}
        {todosCopy}
        {workspaceCopy}
        {sectionCopy}
        {commentsCopy}
        locale={data.locale}
        {todoPriorityOptions}
        referenceDate={homeworkReferenceDate}
        {openTodoEditor}
        {toggleTodoCompletion}
        {deleteTodo}
        {createTodoAction}
        {updateTodoAction}
        todoItems={signedData.todos ?? []}
        {commonCopy}
        todoActionError={state.todoActionError}
        todoSavingById={state.todoSavingById}
        isCreatingTodo={state.isCreatingTodo}
        isUpdatingTodo={state.isUpdatingTodo}
        bind:showCreateTodo={state.showCreateTodo}
        bind:selectedTodo={state.selectedTodo}
        bind:editingTodo={state.editingTodo}
        bind:createTodoError={state.createTodoError}
        bind:editTodoError={state.editTodoError}
      />
    {:else if signedData.tab === "homeworks" && signedData.homeworks}
      <HomeworksTab
        canWriteShared={signedData.homeworkCapabilities?.canWriteShared === true}
        readOnlyReason={signedData.demo?.readOnlyReason}
        {CommentsPanel}
        {commonCopy}
        {workspaceCopy}
        {sectionCopy}
        {homeworksCopy}
        {homeworkCopy}
        homeworkActionError={state.homeworkActionError}
        {commentsCopy}
        locale={data.locale}
        {signedData}
        referenceDate={homeworkReferenceDate}
        {openCreateHomeworkDialog}
        {toggleHomeworkCompletion}
        {createHomeworkAction}
        bind:showCreateHomework={state.showCreateHomework}
        bind:createHomeworkAdvancedOpen={state.createHomeworkAdvancedOpen}
        bind:createHomeworkPublishedAt={state.createHomeworkPublishedAt}
        bind:createHomeworkSectionId={state.createHomeworkSectionId}
        bind:createHomeworkSubmissionDueAt={state.createHomeworkSubmissionDueAt}
        bind:createHomeworkSubmissionStartAt={state.createHomeworkSubmissionStartAt}
        bind:selectedHomework={state.selectedHomework}
        bind:homeworkItems
        bind:homeworkSavingById={state.homeworkSavingById}
        bind:createHomeworkError={state.createHomeworkError}
        bind:isCreatingHomework={state.isCreatingHomework}
      />
    {:else if signedData.tab === "exams" && signedData.subscriptions}
      {@const examSignedData = signedData as NonNullable<typeof signedData> & { subscriptions: NonNullable<typeof signedData.subscriptions> }}
      <ExamsTab
        pageDemo={signedData.demo}
        {workspaceCopy}
        {subscriptionsCopy}
        {sectionCopy}
        signedData={examSignedData}
        {workspaceTabHref}
        {examTimeLabel}
        {examMetadataLabels}
        {namePrimary}
        {examRows}
        locale={data.locale}
      />
    {:else if signedData.tab === "subscriptions" && signedData.subscriptions}
      <SubscriptionsTab
        {workspaceCopy}
        {sectionCopy}
        {subscriptionsCopy}
        signedData={signedData as WorkspaceSubscriptionsTabProps["signedData"]}
        {selectedImportSectionIdSet}
        {canMatchImportSections}
        {formatMessage}
        {namePrimary}
        {nameSecondary}
        {resetBulkImport}
        {searchQuickAddSections}
        {openBulkImportDialog}
        {toggleImportSectionSelection}
        {matchImportSections}
        {confirmImportSections}
        {removeSubscribedSection}
        bulkImportMessage={state.bulkImportMessage}
        bulkImportError={state.bulkImportError}
        isMatchingSections={state.isMatchingSections}
        isImportingSections={state.isImportingSections}
        removingSectionId={state.removingSectionId}
        {subscribeQuickAddSections}
        subscriptionActionError={state.subscriptionActionError}
        matchedSections={state.matchedSections}
        unmatchedSectionCodes={state.unmatchedSectionCodes}
        bind:isBulkImportOpen={state.isBulkImportOpen}
        bind:isConfirmImportOpen={state.isConfirmImportOpen}
        bind:bulkImportSemesterId={state.bulkImportSemesterId}
        bind:bulkImportText={state.bulkImportText}
      />
    {:else if signedData.tab === "links"}
      <LinksTab
        {workspaceCopy}
        {submitWorkspaceLinkPin}
        {linkIconLabel}
        linkReturnTo={state.linkReturnTo}
        linkActionError={state.linkActionError}
        updatingCatalogLinkSlug={state.updatingCatalogLinkSlug}
        groups={signedLinkGroups}
        bind:linkSearchQuery={state.linkSearchQuery}
      />
    {:else if signedData.tab === "bus"}
      <BusTab
        {busCopy}
        bus={signedData.bus ?? null}
        savePreferences={true}
      />
    {:else if signedData.tab === "calendar"}
      <CalendarTab
        {copy}
        {commonCopy}
        {workspaceCopy}
        {sectionCopy}
        {subscriptionsCopy}
        {calendarWeekdayLabels}
        signedData={signedData as WorkspaceCalendarTabProps["signedData"]}
        {workspaceTabHref}
        {formatMessage}
        {sessionHref}
        {setCalendarView}
        {setCalendarDay}
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
        calendarView={state.calendarView}
        calendarDay={state.calendarDay}
        calendarMonth={state.calendarMonth}
        calendarWeekStart={state.calendarWeekStart}
        calendarSemesterId={state.calendarSemesterId}
        {calendarData}
      />
    {/if}
  {:else if data.signedIn && data.userMissing}
    <Alert.Message>{commonCopy.userNotFound}</Alert.Message>
  {/if}
</CollectionPage>
