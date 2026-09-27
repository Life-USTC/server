<script lang="ts">
import { onDestroy } from "svelte";
import {
  addDays,
  calendarEventsForDay,
} from "@/features/workspace/lib/calendar";
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
import {
  fetchPersonalCalendar,
  type PersonalCalendarItem,
  personalItemsForDay,
} from "@/features/young/lib/personal-calendar-client";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { browser } from "$app/environment";
import { Button } from "$lib/components/ui/button";
import OverviewFocusCard from "./OverviewFocusCard.svelte";
import OverviewLinksGrid from "./OverviewLinksGrid.svelte";
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

let youngItems: PersonalCalendarItem[] = [];
let youngFailed = false;
let youngLoading = true;
let youngOwnerId = "";
let youngController: AbortController | undefined;
let requestedRange = "";
$: ownerId = signedData.navStats.user.id;
$: visibleYoungItems = youngOwnerId === ownerId ? youngItems : [];
$: activityCopy = getWorkspacePageCopy(locale === "en-us" ? "en-us" : "zh-cn");
$: overviewStart = signedData.overview?.calendar?.todayDate ?? "";
$: overviewWeekStart = buildWorkspaceOverviewWeekStart(signedData);
$: rangeStart =
  overviewStart && overviewWeekStart
    ? [overviewStart, overviewWeekStart].sort()[0]
    : "";
$: rangeEnd =
  overviewStart && overviewWeekStart
    ? [addDays(overviewStart, 6), addDays(overviewWeekStart, 6)].sort()[1]
    : "";
$: if (
  browser &&
  rangeStart &&
  rangeEnd &&
  `${ownerId}:${locale}:${rangeStart}:${rangeEnd}` !== requestedRange
) {
  requestedRange = `${ownerId}:${locale}:${rangeStart}:${rangeEnd}`;
  void loadYoung(ownerId, rangeStart, rangeEnd);
}
async function loadYoung(requestOwnerId: string, from: string, to: string) {
  youngController?.abort();
  const controller = new AbortController();
  youngController = controller;
  youngItems = [];
  youngOwnerId = requestOwnerId;
  youngFailed = false;
  youngLoading = true;
  try {
    const items = await fetchPersonalCalendar(from, to, controller.signal);
    if (
      !controller.signal.aborted &&
      signedData.navStats.user.id === requestOwnerId
    )
      youngItems = items.filter((item) => item.type === "young_event");
  } catch {
    if (
      !controller.signal.aborted &&
      signedData.navStats.user.id === requestOwnerId
    )
      youngFailed = true;
  } finally {
    if (
      !controller.signal.aborted &&
      signedData.navStats.user.id === requestOwnerId
    )
      youngLoading = false;
  }
}
onDestroy(() => youngController?.abort());

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
  activities: PersonalCalendarItem[],
) {
  return buildOverviewCalendarWeekDays(
    overviewCalendar,
    overviewWeekStart,
    calendarTimelineItemsForDay,
    locale,
    activities,
  );
}

function overviewAgendaDays(
  overviewCalendar: WorkspaceCalendarPreviewData,
  activities: PersonalCalendarItem[],
): WorkspaceAgendaDay[] {
  return buildWorkspaceAgendaDays({
    calendar: overviewCalendar,
    eventsForDay: calendarEventsForDay,
    locale,
    startKey: overviewCalendar.todayDate,
    timelineItemsForDay: calendarTimelineItemsForDay,
  }).map((day) => ({
    ...day,
    events: [...day.events, ...personalItemsForDay(activities, day.key)].sort(
      (left, right) => left.sort - right.sort,
    ),
  }));
}

function overviewReference(value: unknown): Date | string | null {
  return typeof value === "string" || value instanceof Date ? value : null;
}

function overviewFocus(
  overviewCalendar: WorkspaceCalendarPreviewData,
  days: WorkspaceAgendaDay[],
  activities: PersonalCalendarItem[],
) {
  const currentTime = workspaceReferenceTime(
    overviewReference(signedData.referenceNow) ??
      overviewReference(overviewCalendar.referenceDate),
  );
  const todayEvents = calendarEventsForDay(
    overviewCalendar,
    overviewCalendar.todayDate,
  );
  const now = Date.parse(
    String(signedData.referenceNow ?? overviewCalendar.referenceDate),
  );
  const currentActivity = activities
    .filter(
      (item) =>
        item.at &&
        item.endsAt &&
        Date.parse(item.at) <= now &&
        Date.parse(item.endsAt) > now,
    )
    .sort(
      (left, right) => Date.parse(left.at ?? "") - Date.parse(right.at ?? ""),
    )[0];
  return workspaceFocusItem({
    currentEventKey:
      currentWorkspaceTimedEventKey(todayEvents, currentTime) ??
      currentActivity?.id,
    currentTime,
    days,
    todayKey: overviewCalendar.todayDate,
  });
}
</script>

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

{#if signedData.overview}
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
    {@const agendaDays = overviewAgendaDays(overviewCalendar, visibleYoungItems)}
    <div class="grid min-w-0 gap-8 lg:gap-10">
      <OverviewFocusCard
        copy={workspaceCopy.focus}
        loadingLabel={youngLoading ? activityCopy.youngEvents.workspace.loading : null}
        focus={overviewFocus(overviewCalendar, agendaDays, visibleYoungItems)}
      />

      {#if youngFailed}
        <div class="grid gap-2">
          <p role="alert">{activityCopy.youngEvents.workspace.failed}</p>
          <Button class="justify-self-start" variant="outline" onclick={() => requestedRange = ""}>{activityCopy.youngEvents.workspace.retry}</Button>
        </div>
      {/if}

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

      <div class="min-w-0">
        <OverviewWeekCard
          {workspaceCopy}
          {workspaceTabHref}
          days={overviewCalendarWeekDays(overviewCalendar, overviewWeekStart, visibleYoungItems)}
          {formatMessage}
        />
      </div>

      <OverviewSummaryCards
        {calendarExamDetail}
        {commonCopy}
        {workspaceCopy}
        {workspaceTabHref}
        examsCount={signedData.navStats.examsCount}
        {fmtDate}
        {formatMessage}
        homeworkCopy={copy.homeworks}
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

      {#if signedData.overview && !signedData.overview.hasCurrentTermSelection && hasWorkspaceSubscriptions(signedData)}
        <OverviewTermSelectionCard
          {workspaceCopy}
          {workspaceTabHref}
          description={signedData.overview.currentTermName
            ? workspaceCopy.termSelection.noCurrentTerm
            : workspaceCopy.termSelection.noCurrentSemester}
          historyCalendarSemesterId={signedData.overview.calendar.calendarSemesterPicker?.at(-1)?.id ?? null}
          showHistoryActions={true}
        />
      {/if}

      <OverviewLinksGrid
        {workspaceCopy}
        {workspaceTabHref}
        {linkIconLabel}
        links={overviewLinkItems}
        {submitWorkspaceLinkPin}
        {updatingCatalogLinkSlug}
      />
    </div>
  {/if}
{/if}
