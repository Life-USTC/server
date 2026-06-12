<script lang="ts">
import { calendarExamDetail } from "@/features/dashboard/lib/calendar-display";
import type {
  DashboardCommonCopy,
  DashboardDashboardCopy,
  DashboardLinkPinSubmit,
  DashboardOverviewLinkItem,
  DashboardRootCopy,
  DashboardSectionCopy,
  DashboardSubscriptionsCopy,
  DashboardTodoItem,
  DashboardTodosCopy,
} from "@/features/dashboard/lib/dashboard-controller-helpers";
import { hasDashboardSubscriptions } from "@/features/dashboard/lib/dashboard-subscription-state";
import {
  fmtTime,
  formatMessage,
  homeworksOverdueForOverview,
  pendingTodosForOverview,
  todosDueSoonForOverview,
  todosDueTodayForOverview,
  todosOverdueForOverview,
} from "@/features/dashboard/lib/overview";
import DashboardNoSubscriptionsState from "./DashboardNoSubscriptionsState.svelte";
import type {
  DashboardCalendarData,
  DashboardCalendarSession,
  DashboardCalendarTabHref,
} from "./dashboard-calendar-component-types";
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
export let todoPriorityClass: (priority: string) => string;
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

function overviewUpcomingExams(overviewCalendar: DashboardCalendarData) {
  return buildOverviewUpcomingExams(overviewCalendar, signedData);
}

function sessionHref(session: Pick<DashboardCalendarSession, "sectionJwId">) {
  return overviewSessionHref(session, dashboardTabHref);
}

function overviewCalendarWeekDays(
  overviewCalendar: DashboardCalendarData,
  overviewWeekStart: string,
) {
  return buildOverviewCalendarWeekDays(
    overviewCalendar,
    overviewWeekStart,
    calendarTimelineItemsForDay,
  );
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
        { href: "/sections", label: subscriptionsCopy.browseSections },
        { href: "/courses", label: subscriptionsCopy.browseCourses, variant: "outline" },
        { href: dashboardTabHref("subscriptions"), label: dashboardCopy.termSelection.matchByCode, variant: "outline" },
      ]}
    />
  {/if}

  {@const overviewPendingTodos = pendingTodosForOverview(signedData)}
  {@const overviewTodosDueToday = todosDueTodayForOverview(overviewPendingTodos, signedData)}
  {@const overviewTodosDueSoon = todosDueSoonForOverview(overviewPendingTodos, signedData)}
  {@const overviewOverdueHomeworks = homeworksOverdueForOverview(signedData)}
  {@const overviewOverdueTodos = todosOverdueForOverview(overviewPendingTodos, signedData)}

  {#if signedData.overview?.calendar}
    {@const overviewCalendar = signedData.overview.calendar}
    {@const overviewWeekStart = dashboardOverviewWeekStart()}
    {@const upcomingOverviewExams = overviewUpcomingExams(overviewCalendar)}
    <div class="grid gap-4">
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
        {sessionHref}
        todaySessions={signedData.overview.todaySessions}
        {todoPriorityClass}
        {todosCopy}
        {todoStatus}
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
        pendingHomeworks={signedData.overview.pendingHomeworks}
        pendingTodos={overviewPendingTodos}
        {sectionCopy}
        {todoPriorityClass}
        {todosCopy}
        todosDueSoon={overviewTodosDueSoon}
        todosDueToday={overviewTodosDueToday}
        {todoStatus}
        upcomingExams={upcomingOverviewExams}
      />

      <OverviewWeekCard
        {dashboardCopy}
        {dashboardTabHref}
        days={overviewCalendarWeekDays(overviewCalendar, overviewWeekStart)}
        {formatMessage}
      />
    </div>
  {/if}
{/if}
  
