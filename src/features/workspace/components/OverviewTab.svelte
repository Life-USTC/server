<script lang="ts">
import { onDestroy } from "svelte";
import { Button } from "#lib/components/ui/button/index.js";
import {
  addDays,
  calendarEventsForDay,
} from "@/features/workspace/lib/calendar";
import {
  homeworksOverdueForOverview,
  pendingTodosForOverview,
  todosOverdueForOverview,
} from "@/features/workspace/lib/overview";
import {
  OVERVIEW_FULL_WIDTH_CLASS,
  overviewListPlacement,
} from "@/features/workspace/lib/overview-layout";
import { buildOverviewStack } from "@/features/workspace/lib/overview-stack";
import {
  buildWorkspaceAgendaDays,
  currentWorkspaceTimedEventKey,
  type WorkspaceAgendaDay,
  workspaceFocusItem,
  workspaceReferenceTime,
} from "@/features/workspace/lib/workspace-agenda";
import type {
  WorkspaceCalendarPreviewData,
  WorkspaceCopy,
  WorkspaceLinkPinSubmit,
  WorkspaceOverviewLinkItem,
  WorkspaceSubscriptionsCopy,
} from "@/features/workspace/lib/workspace-controller-helpers";
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import {
  fetchPersonalCalendar,
  type PersonalCalendarItem,
  personalItemsForDay,
} from "@/features/young/lib/personal-calendar-client";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { toCampusDateKey } from "@/lib/time/campus-date";
import { browser } from "$app/env";
import OverviewFocusCard from "./OverviewFocusCard.svelte";
import OverviewLinksGrid from "./OverviewLinksGrid.svelte";
import OverviewTermSelectionCard from "./OverviewTermSelectionCard.svelte";
import OverviewTimelineSection from "./OverviewTimelineSection.svelte";
import type {
  OverviewCalendarTimelineItemsForDay,
  OverviewSignedData,
} from "./overview-tab-types";
import WorkspaceNoSubscriptionsState from "./WorkspaceNoSubscriptionsState.svelte";
import type { WorkspaceCalendarTabHref } from "./workspace-calendar-component-types";

export let workspaceCopy: WorkspaceCopy;
export let subscriptionsCopy: WorkspaceSubscriptionsCopy;
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
$: rangeStart = overviewStart;
$: rangeEnd = overviewStart ? addDays(overviewStart, 6) : "";
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
function overviewStack(
  days: WorkspaceAgendaDay[],
  focusKey: string | undefined,
) {
  const homeworks = homeworksOverdueForOverview(signedData);
  const todos = todosOverdueForOverview(
    pendingTodosForOverview(signedData),
    signedData,
  );
  const overdueItems = calendarTimelineItemsForDay({
    sessions: [],
    exams: [],
    homeworks,
    todos,
  });
  const dueDates = new Map<string, Date | string | null | undefined>([
    ...homeworks.map(
      (item) => [`homework-${item.id}`, item.submissionDueAt] as const,
    ),
    ...todos.map((item) => [`todo-${item.id}`, item.dueAt] as const),
  ]);
  return buildOverviewStack({
    days,
    focusKey,
    todayKey: overviewStart,
    currentTime: workspaceReferenceTime(
      overviewReference(signedData.referenceNow) ??
        overviewReference(signedData.overview?.calendar?.referenceDate),
    ),
    locale,
    overdue: overdueItems.map((item) => ({
      ...item,
      dateKey: toCampusDateKey(dueDates.get(item.key)) ?? "",
    })),
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

{#if signedData.overview?.calendar}
    {@const overviewCalendar = signedData.overview.calendar}
    {@const agendaDays = overviewAgendaDays(overviewCalendar, visibleYoungItems)}
    {@const focus = overviewFocus(overviewCalendar, agendaDays, visibleYoungItems)}
    {@const stack = overviewStack(agendaDays, focus?.key)}
    {@const listPlacement = overviewListPlacement({
      upcoming: stack.upcoming.length,
      urgency: stack.urgency.length,
    }).list}
    <div
      class="grid min-w-0 gap-8 lg:grid-cols-2 lg:items-start lg:gap-x-10 lg:gap-y-10"
      data-overview-sections
    >
      <OverviewFocusCard
        class={OVERVIEW_FULL_WIDTH_CLASS}
        copy={workspaceCopy.focus}
        loadingLabel={youngLoading ? activityCopy.youngEvents.workspace.loading : null}
        {focus}
      />

      {#if youngFailed}
        <div class={`grid gap-2 ${OVERVIEW_FULL_WIDTH_CLASS}`}>
          <p role="alert">{activityCopy.youngEvents.workspace.failed}</p>
          <Button class="justify-self-start" variant="outline" onclick={() => requestedRange = ""}>{activityCopy.youngEvents.workspace.retry}</Button>
        </div>
      {/if}

      {#if stack.urgency.length > 0}
        <OverviewTimelineSection
          class={listPlacement.class}
          wide={listPlacement.wide}
          testId="workspace-overview-urgency"
          title={workspaceCopy.stack.urgency}
          items={stack.urgency}
          destinations={[
            { href: workspaceTabHref("homeworks"), label: workspaceCopy.nav.homeworks.title },
            { href: workspaceTabHref("todos"), label: workspaceCopy.nav.todos.title },
          ]}
          viewAllLabel={workspaceCopy.viewAll as string}
        />
      {/if}

      {#if stack.upcoming.length > 0}
        <OverviewTimelineSection
          class={listPlacement.class}
          wide={listPlacement.wide}
          testId="workspace-overview-upcoming"
          title={workspaceCopy.stack.upcoming}
          items={stack.upcoming}
          destinations={[
            { href: workspaceTabHref("calendar"), label: workspaceCopy.nav.calendar.title },
            { href: workspaceTabHref("homeworks"), label: workspaceCopy.nav.homeworks.title },
            { href: workspaceTabHref("todos"), label: workspaceCopy.nav.todos.title },
            { href: workspaceTabHref("exams"), label: workspaceCopy.nav.exams.title },
          ]}
          viewAllLabel={workspaceCopy.viewAll as string}
        />
      {/if}

      {#if signedData.overview && !signedData.overview.hasCurrentTermSelection && hasWorkspaceSubscriptions(signedData)}
        <OverviewTermSelectionCard
          class={OVERVIEW_FULL_WIDTH_CLASS}
          workspaceCopy={workspaceCopy}
          workspaceTabHref={workspaceTabHref}
          description={signedData.overview.currentTermName
            ? workspaceCopy.termSelection.noCurrentTerm
            : workspaceCopy.termSelection.noCurrentSemester}
          historyCalendarSemesterId={signedData.overview.calendar.calendarSemesterPicker?.at(-1)?.id ?? null}
          showHistoryActions={true}
        />
      {/if}

      {#if overviewLinkItems.length > 0}
      <OverviewLinksGrid
        class={OVERVIEW_FULL_WIDTH_CLASS}
        workspaceCopy={workspaceCopy}
        workspaceTabHref={workspaceTabHref}
        linkIconLabel={linkIconLabel}
        links={overviewLinkItems}
        submitWorkspaceLinkPin={submitWorkspaceLinkPin}
        updatingCatalogLinkSlug={updatingCatalogLinkSlug}
      />
      {/if}
    </div>
{/if}
