<script lang="ts">
import { calendarEventsForDay } from "@/features/workspace/lib/calendar";
import { calendarExamDetail } from "@/features/workspace/lib/calendar-display";
import {
  fmtTime,
  formatMessage,
  homeworksOverdueForOverview,
  pendingTodosForOverview,
  todosDueSoonForOverview,
  todosDueTodayForOverview,
  todosOverdueForOverview,
} from "@/features/workspace/lib/overview";
import { WORKSPACE_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import {
  buildWorkspaceAgendaDays,
  currentWorkspaceTimedEventKey,
  type WorkspaceAgendaDay,
  workspaceFocusItem,
  workspaceReferenceTime,
} from "@/features/workspace/lib/workspace-agenda";
import type {
  WorkspaceCalendarPreviewData,
  WorkspaceCommonCopy,
  WorkspaceCopy,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
  WorkspaceRootCopy,
  WorkspaceSectionCopy,
  WorkspaceSubscriptionsCopy,
  WorkspaceTodoItem,
  WorkspaceTodosCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import OverviewFocusCard from "./OverviewFocusCard.svelte";
import OverviewLinksGrid from "./OverviewLinksGrid.svelte";
import OverviewMissingCurrentTerm from "./OverviewMissingCurrentTerm.svelte";
import OverviewSummaryCards from "./OverviewSummaryCards.svelte";
import OverviewTermSelectionCard from "./OverviewTermSelectionCard.svelte";
import OverviewTodayOverdueCards from "./OverviewTodayOverdueCards.svelte";
import OverviewWeekCard from "./OverviewWeekCard.svelte";
import type {
  OverviewCalendarTimelineItemsForDay,
  OverviewSignedData,
} from "./overview-tab-types";
import {
  overviewCalendarWeekDays as buildOverviewCalendarWeekDays,
  overviewUpcomingExams as buildOverviewUpcomingExams,
  workspaceOverviewWeekStart as buildWorkspaceOverviewWeekStart,
  formatOverviewDate,
  formatOverviewHomeworkEta,
  overviewSessionHref,
  overviewTodoStatus,
} from "./overview-tab-view-model";
import WorkspaceNoSubscriptionsState from "./WorkspaceNoSubscriptionsState.svelte";
import type {
  WorkspaceCalendarSession,
  WorkspaceCalendarTabHref,
} from "./workspace-calendar-component-types";

export let copy: WorkspaceRootCopy;
export let commonCopy: WorkspaceCommonCopy;
export let workspaceCopy: WorkspaceCopy;
export let sectionCopy: WorkspaceSectionCopy;
export let subscriptionsCopy: WorkspaceSubscriptionsCopy;
export let todosCopy: WorkspaceTodosCopy;
export let signedData: OverviewSignedData;
export let locale: string;

export let workspaceTabHref: WorkspaceCalendarTabHref;
export let submitWorkspaceLinkPin: WorkspaceLinkPinSubmit;
export let linkIconLabel: (icon: string) => string;
export let calendarTimelineItemsForDay: OverviewCalendarTimelineItemsForDay;

export let overviewLinkItems: WorkspaceOverviewLinkItem[];
export let updatingCatalogLinkSlug: string | null;

function fmtDate(value: Date | string | null | undefined) {
  return formatOverviewDate(value, sectionCopy, signedData, locale);
}

function homeworkEtaLabel(value: Date | string | null | undefined) {
  return formatOverviewHomeworkEta(value, sectionCopy, signedData, locale);
}

function todoStatus(todo: WorkspaceTodoItem) {
  return overviewTodoStatus(todo, workspaceCopy);
}

function workspaceOverviewWeekStart() {
  return buildWorkspaceOverviewWeekStart(signedData);
}

function overviewUpcomingExams(overviewCalendar: WorkspaceCalendarPreviewData) {
  return buildOverviewUpcomingExams(overviewCalendar, signedData);
}

function sessionHref(session: Pick<WorkspaceCalendarSession, "sectionJwId">) {
  return overviewSessionHref(session, workspaceTabHref);
}

function overviewCalendarWeekDays(
  overviewCalendar: WorkspaceCalendarPreviewData,
  overviewWeekStart: string,
) {
  return buildOverviewCalendarWeekDays(
    overviewCalendar,
    overviewWeekStart,
    calendarTimelineItemsForDay,
    locale,
  );
}

function overviewAgendaDays(
  overviewCalendar: WorkspaceCalendarPreviewData,
): WorkspaceAgendaDay[] {
  return buildWorkspaceAgendaDays({
    calendar: overviewCalendar,
    eventsForDay: calendarEventsForDay,
    locale,
    startKey: overviewCalendar.todayDate,
    timelineItemsForDay: calendarTimelineItemsForDay,
  });
}

function overviewReference(value: unknown): Date | string | null {
  return typeof value === "string" || value instanceof Date ? value : null;
}

function overviewFocus(
  overviewCalendar: WorkspaceCalendarPreviewData,
  days: WorkspaceAgendaDay[],
) {
  const currentTime = workspaceReferenceTime(
    overviewReference(signedData.referenceNow) ??
      overviewReference(overviewCalendar.referenceDate),
  );
  const todayEvents = calendarEventsForDay(
    overviewCalendar,
    overviewCalendar.todayDate,
  );
  return workspaceFocusItem({
    currentEventKey: currentWorkspaceTimedEventKey(todayEvents, currentTime),
    currentTime,
    days,
    todayKey: overviewCalendar.todayDate,
  });
}
</script>

{#if signedData.overview && !signedData.overview.hasCurrentTermSelection && hasWorkspaceSubscriptions(signedData)}
  <OverviewMissingCurrentTerm
    {workspaceCopy}
    {workspaceTabHref}
    {linkIconLabel}
    links={overviewLinkItems}
    pendingTodosCount={signedData.navStats.pendingTodosCount}
    {signedData}
    {submitWorkspaceLinkPin}
    {updatingCatalogLinkSlug}
  />
{:else}
  {#if !hasWorkspaceSubscriptions(signedData)}
    <WorkspaceNoSubscriptionsState
      title={subscriptionsCopy.noSubscriptions}
      description={subscriptionsCopy.noSubscriptionsDescription}
      actions={[
        { href: "/catalog/sections", label: subscriptionsCopy.browseSections },
        { href: "/catalog/courses", label: subscriptionsCopy.browseCourses, variant: "outline" },
        { href: workspaceTabHref("subscriptions"), label: workspaceCopy.termSelection.matchByCode, variant: "outline" },
      ]}
    />
  {/if}

  {@const overviewPendingTodos = pendingTodosForOverview(signedData)}
  {@const overviewTodosDueToday = todosDueTodayForOverview(overviewPendingTodos, signedData)}
  {@const overviewTodosDueSoon = todosDueSoonForOverview(overviewPendingTodos, signedData)}
  {@const overviewOverdueHomeworks = homeworksOverdueForOverview(signedData)}
  {@const overviewOverdueTodos = todosOverdueForOverview(overviewPendingTodos, signedData)}
  {@const overviewOverdueHomeworkIds = new Set(overviewOverdueHomeworks.map((homework) => homework.id))}
  {@const overviewOverdueTodoIds = new Set(overviewOverdueTodos.map((todo) => todo.id))}
  {@const overviewSummaryHomeworks = (signedData.overview?.pendingHomeworks ?? []).filter(
    (homework) => !overviewOverdueHomeworkIds.has(homework.id),
  )}
  {@const overviewSummaryTodos = overviewPendingTodos.filter(
    (todo) => !overviewOverdueTodoIds.has(todo.id),
  )}

  {#if signedData.overview?.calendar}
    {@const overviewCalendar = signedData.overview.calendar}
    {@const overviewWeekStart = workspaceOverviewWeekStart()}
    {@const upcomingOverviewExams = overviewUpcomingExams(overviewCalendar)}
    {@const agendaDays = overviewAgendaDays(overviewCalendar)}
    <div class="grid min-w-0 gap-8 lg:gap-10">
      <OverviewFocusCard
        copy={workspaceCopy.focus}
        focus={overviewFocus(overviewCalendar, agendaDays)}
      />

      <div class="min-w-0">
        <OverviewWeekCard
          {workspaceCopy}
          {workspaceTabHref}
          days={overviewCalendarWeekDays(overviewCalendar, overviewWeekStart)}
          {formatMessage}
        />
      </div>

      <OverviewLinksGrid
        {workspaceCopy}
        {workspaceTabHref}
        {linkIconLabel}
        links={overviewLinkItems}
        {submitWorkspaceLinkPin}
        {updatingCatalogLinkSlug}
      />

      <OverviewTodayOverdueCards
        {copy}
        {commonCopy}
        {workspaceCopy}
        {workspaceTabHref}
        dueTodayHomeworks={signedData.overview.dueToday}
        dueTodayTodos={overviewTodosDueToday}
        {fmtDate}
        {fmtTime}
        {homeworkEtaLabel}
        overdueHomeworks={overviewOverdueHomeworks}
        overdueTodos={overviewOverdueTodos}
        previewLimit={WORKSPACE_OVERVIEW_PREVIEW_LIMIT}
        {sessionHref}
        todaySessions={signedData.overview.todaySessions}
        {todosCopy}
        {todoStatus}
        viewAllLabel={workspaceCopy.viewAll as string}
      />

      <OverviewSummaryCards
        {calendarExamDetail}
        {commonCopy}
        {workspaceCopy}
        {workspaceTabHref}
        examsCount={signedData.navStats.examsCount}
        {fmtDate}
        {formatMessage}
        {homeworkEtaLabel}
        pendingHomeworks={overviewSummaryHomeworks}
        pendingTodos={overviewSummaryTodos}
        previewLimit={WORKSPACE_OVERVIEW_PREVIEW_LIMIT}
        {sectionCopy}
        {todosCopy}
        todosDueSoon={overviewTodosDueSoon}
        todosDueToday={overviewTodosDueToday}
        {todoStatus}
        upcomingExams={upcomingOverviewExams}
        viewAllLabel={workspaceCopy.viewAll as string}
      />
    </div>
  {/if}
{/if}
  
