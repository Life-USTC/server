<script lang="ts">
import { calendarEventsForDay } from "@/features/workspace/lib/calendar";
import { calendarExamDetail } from "@/features/workspace/lib/calendar-display";
import {
  buildDashboardAgendaDays,
  currentDashboardTimedEventKey,
  type DashboardAgendaDay,
  dashboardFocusItem,
  dashboardReferenceTime,
} from "@/features/workspace/lib/dashboard-agenda";
import type {
  DashboardCalendarPreviewData,
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
  DashboardRootCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/workspace/lib/dashboard-controller-helpers";
import { hasDashboardSubscriptions } from "@/features/workspace/lib/dashboard-subscription-state";
import {
  fmtTime,
  formatMessage,
  homeworksOverdueForOverview,
  pendingTodosForOverview,
  todosDueSoonForOverview,
  todosDueTodayForOverview,
  todosOverdueForOverview,
} from "@/features/workspace/lib/overview";
import { DASHBOARD_OVERVIEW_PREVIEW_LIMIT } from "@/features/workspace/lib/overview-preview";
import DashboardNoSubscriptionsState from "./DashboardNoSubscriptionsState.svelte";
import type {
  DashboardCalendarSession,
  DashboardCalendarTabHref,
} from "./dashboard-calendar-component-types";
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
  dashboardOverviewWeekStart as buildDashboardOverviewWeekStart,
  overviewCalendarWeekDays as buildOverviewCalendarWeekDays,
  overviewUpcomingExams as buildOverviewUpcomingExams,
  formatOverviewDate,
  formatOverviewHomeworkEta,
  overviewSessionHref,
  overviewTodoStatus,
} from "./overview-tab-view-model";

export let copy: DashboardRootCopy;
export let commonCopy: DashboardCommonCopy;
export let dashboardCopy: DashboardDashboardCopy;
export let sectionCopy: DashboardSectionCopy;
export let subscriptionsCopy: DashboardSubscriptionsCopy;
export let todosCopy: DashboardTodosCopy;
export let signedData: OverviewSignedData;
export let locale: string;

export let dashboardTabHref: DashboardCalendarTabHref;
export let submitDashboardLinkPin: DashboardLinkPinSubmit;
export let linkIconLabel: (icon: string) => string;
export let calendarTimelineItemsForDay: OverviewCalendarTimelineItemsForDay;

export let overviewLinkItems: DashboardOverviewLinkItem[];
export let updatingDashboardLinkSlug: string | null;

function fmtDate(value: Date | string | null | undefined) {
  return formatOverviewDate(value, sectionCopy, signedData, locale);
}

function homeworkEtaLabel(value: Date | string | null | undefined) {
  return formatOverviewHomeworkEta(value, sectionCopy, signedData, locale);
}

function todoStatus(todo: DashboardTodoItem) {
  return overviewTodoStatus(todo, dashboardCopy);
}

function dashboardOverviewWeekStart() {
  return buildDashboardOverviewWeekStart(signedData);
}

function overviewUpcomingExams(overviewCalendar: DashboardCalendarPreviewData) {
  return buildOverviewUpcomingExams(overviewCalendar, signedData);
}

function sessionHref(session: Pick<DashboardCalendarSession, "sectionJwId">) {
  return overviewSessionHref(session, dashboardTabHref);
}

function overviewCalendarWeekDays(
  overviewCalendar: DashboardCalendarPreviewData,
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
  overviewCalendar: DashboardCalendarPreviewData,
): DashboardAgendaDay[] {
  return buildDashboardAgendaDays({
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
  overviewCalendar: DashboardCalendarPreviewData,
  days: DashboardAgendaDay[],
) {
  const currentTime = dashboardReferenceTime(
    overviewReference(signedData.referenceNow) ??
      overviewReference(overviewCalendar.referenceDate),
  );
  const todayEvents = calendarEventsForDay(
    overviewCalendar,
    overviewCalendar.todayDate,
  );
  return dashboardFocusItem({
    currentEventKey: currentDashboardTimedEventKey(todayEvents, currentTime),
    currentTime,
    days,
    todayKey: overviewCalendar.todayDate,
  });
}
</script>

{#if signedData.overview && !signedData.overview.hasCurrentTermSelection && hasDashboardSubscriptions(signedData)}
  <OverviewMissingCurrentTerm
    {dashboardCopy}
    {dashboardTabHref}
    {linkIconLabel}
    links={overviewLinkItems}
    pendingTodosCount={signedData.navStats.pendingTodosCount}
    {signedData}
    {submitDashboardLinkPin}
    {updatingDashboardLinkSlug}
  />
{:else}
  {#if !hasDashboardSubscriptions(signedData)}
    <DashboardNoSubscriptionsState
      title={subscriptionsCopy.noSubscriptions}
      description={subscriptionsCopy.noSubscriptionsDescription}
      actions={[
        { href: "/catalog/sections", label: subscriptionsCopy.browseSections },
        { href: "/catalog/courses", label: subscriptionsCopy.browseCourses, variant: "outline" },
        { href: dashboardTabHref("subscriptions"), label: dashboardCopy.termSelection.matchByCode, variant: "outline" },
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
    {@const overviewWeekStart = dashboardOverviewWeekStart()}
    {@const upcomingOverviewExams = overviewUpcomingExams(overviewCalendar)}
    {@const agendaDays = overviewAgendaDays(overviewCalendar)}
    <div class="grid min-w-0 gap-8 lg:gap-10">
      <OverviewFocusCard
        copy={dashboardCopy.focus}
        focus={overviewFocus(overviewCalendar, agendaDays)}
      />

      <div class="min-w-0">
        <OverviewWeekCard
          {dashboardCopy}
          {dashboardTabHref}
          days={overviewCalendarWeekDays(overviewCalendar, overviewWeekStart)}
          {formatMessage}
        />
      </div>

      <OverviewLinksGrid
        {dashboardCopy}
        {dashboardTabHref}
        {linkIconLabel}
        links={overviewLinkItems}
        {submitDashboardLinkPin}
        {updatingDashboardLinkSlug}
      />

      <OverviewTodayOverdueCards
        {copy}
        {commonCopy}
        {dashboardCopy}
        {dashboardTabHref}
        dueTodayHomeworks={signedData.overview.dueToday}
        dueTodayTodos={overviewTodosDueToday}
        {fmtDate}
        {fmtTime}
        {homeworkEtaLabel}
        overdueHomeworks={overviewOverdueHomeworks}
        overdueTodos={overviewOverdueTodos}
        previewLimit={DASHBOARD_OVERVIEW_PREVIEW_LIMIT}
        {sessionHref}
        todaySessions={signedData.overview.todaySessions}
        {todosCopy}
        {todoStatus}
        viewAllLabel={dashboardCopy.viewAll as string}
      />

      <OverviewSummaryCards
        {calendarExamDetail}
        {commonCopy}
        {dashboardCopy}
        {dashboardTabHref}
        examsCount={signedData.navStats.examsCount}
        {fmtDate}
        {formatMessage}
        {homeworkEtaLabel}
        pendingHomeworks={overviewSummaryHomeworks}
        pendingTodos={overviewSummaryTodos}
        previewLimit={DASHBOARD_OVERVIEW_PREVIEW_LIMIT}
        {sectionCopy}
        {todosCopy}
        todosDueSoon={overviewTodosDueSoon}
        todosDueToday={overviewTodosDueToday}
        {todoStatus}
        upcomingExams={upcomingOverviewExams}
        viewAllLabel={dashboardCopy.viewAll as string}
      />
    </div>
  {/if}
{/if}
  
