<script lang="ts">
import { onDestroy } from "svelte";
import { weekStartFor } from "@/features/workspace/lib/calendar";
import { buildWorkspaceCalendarGridWeeks } from "@/features/workspace/lib/calendar-grid";
import {
  buildWorkspaceAgendaDays,
  type WorkspaceAgendaDay,
} from "@/features/workspace/lib/workspace-agenda";
import { hasWorkspaceSubscriptions } from "@/features/workspace/lib/workspace-subscription-state";
import PersonalActivityCalendar from "@/features/young/components/PersonalActivityCalendar.svelte";
import {
  fetchPersonalCalendar,
  type PersonalCalendarItem,
  personalItemsForDay,
} from "@/features/young/lib/personal-calendar-client";
import { getWorkspacePageCopy } from "@/lib/shell/page-copy";
import { getShellViewer } from "@/lib/shell/shell-viewer";
import { browser } from "$app/environment";
import CalendarAgenda from "$lib/components/calendar/CalendarAgenda.svelte";
import CalendarGrid from "$lib/components/calendar/CalendarGrid.svelte";
import { Button } from "$lib/components/ui/button";
import * as Empty from "$lib/components/ui/empty/index.js";
import CalendarTabToolbar from "./CalendarTabToolbar.svelte";
import type { WorkspaceCalendarTabProps } from "./workspace-calendar-component-types";
import type { FormatMessage } from "./workspace-component-types";

export let copy: WorkspaceCalendarTabProps["copy"];
export let commonCopy: WorkspaceCalendarTabProps["commonCopy"];
export let workspaceCopy: WorkspaceCalendarTabProps["workspaceCopy"];
export let sectionCopy: WorkspaceCalendarTabProps["sectionCopy"];
export let subscriptionsCopy: WorkspaceCalendarTabProps["subscriptionsCopy"];
export let calendarWeekdayLabels: WorkspaceCalendarTabProps["calendarWeekdayLabels"];
export let signedData: WorkspaceCalendarTabProps["signedData"];

export let workspaceTabHref: WorkspaceCalendarTabProps["workspaceTabHref"];
export let formatMessage: FormatMessage;
export let sessionHref: WorkspaceCalendarTabProps["sessionHref"];

export let setCalendarView: WorkspaceCalendarTabProps["setCalendarView"];
export let setCalendarDay: WorkspaceCalendarTabProps["setCalendarDay"];
export let setCalendarMonth: WorkspaceCalendarTabProps["setCalendarMonth"];
export let setCalendarWeek: WorkspaceCalendarTabProps["setCalendarWeek"];
export let setCalendarSemester: WorkspaceCalendarTabProps["setCalendarSemester"];
export let addDays: WorkspaceCalendarTabProps["addDays"];
export let addMonths: WorkspaceCalendarTabProps["addMonths"];
export let monthWeeks: WorkspaceCalendarTabProps["monthWeeks"];
export let calendarEventsForDay: WorkspaceCalendarTabProps["calendarEventsForDay"];
export let calendarTimelineItemsForDay: WorkspaceCalendarTabProps["calendarTimelineItemsForDay"];
export let calendarWeekLabel: WorkspaceCalendarTabProps["calendarWeekLabel"];
export let calendarEventParts: WorkspaceCalendarTabProps["calendarEventParts"];
export let calendarHomeworkHref: WorkspaceCalendarTabProps["calendarHomeworkHref"];
export let calendarSessionChipFields: WorkspaceCalendarTabProps["calendarSessionChipFields"];
export let calendarExamChipFields: WorkspaceCalendarTabProps["calendarExamChipFields"];
export let calendarHomeworkChipFields: WorkspaceCalendarTabProps["calendarHomeworkChipFields"];
export let calendarTodoChipFields: WorkspaceCalendarTabProps["calendarTodoChipFields"];
export let calendarSemesterIndex: WorkspaceCalendarTabProps["calendarSemesterIndex"];

export let calendarView: WorkspaceCalendarTabProps["calendarView"];
export let calendarDay: WorkspaceCalendarTabProps["calendarDay"];
export let calendarMonth: WorkspaceCalendarTabProps["calendarMonth"];
export let calendarWeekStart: WorkspaceCalendarTabProps["calendarWeekStart"];
export let calendarSemesterId: WorkspaceCalendarTabProps["calendarSemesterId"];
export let calendarData: WorkspaceCalendarTabProps["calendarData"];

let baseCalendarGridWeeks: ReturnType<typeof buildWorkspaceCalendarGridWeeks> =
  [];
let baseAgendaDays: WorkspaceAgendaDay[] = [];
let agendaWeekStart = "";

$: agendaWeekStart =
  calendarWeekStart ||
  (calendarData ? weekStartFor(calendarData.todayDate) : "");
$: baseAgendaDays =
  calendarData && agendaWeekStart
    ? buildWorkspaceAgendaDays({
        calendar: calendarData,
        eventsForDay: calendarEventsForDay,
        locale: signedData.locale,
        startKey: calendarView === "day" ? calendarDay : agendaWeekStart,
        dayCount: calendarView === "day" ? 1 : 7,
        timelineItemsForDay: calendarTimelineItemsForDay,
      })
    : [];
$: baseCalendarGridWeeks =
  calendarData && calendarView !== "day"
    ? buildWorkspaceCalendarGridWeeks({
        addDays,
        calendar: calendarData,
        calendarEventParts,
        calendarEventsForDay,
        calendarExamChipFields,
        calendarHomeworkChipFields,
        calendarHomeworkHref,
        calendarSessionChipFields,
        calendarTodoChipFields,
        calendarWeekLabel,
        workspaceTabHref,
        examLabel: copy.CalendarEventCard.exam,
        month: calendarMonth,
        monthWeeks,
        sectionWeekLabel: sectionCopy.weekLabel,
        sessionHref,
        view: calendarView,
        weekStart: calendarWeekStart,
      })
    : [];
const shellViewer = getShellViewer();
let youngItems: PersonalCalendarItem[] = [];
let youngFailed = false;
let youngLoading = true;
let youngOwnerId = "";
let youngController: AbortController | undefined;
let requestedRange = "";
$: ownerId = $shellViewer.viewer?.id ?? "";
$: visibleYoungItems = youngOwnerId === ownerId ? youngItems : [];
$: activityCopy = getWorkspacePageCopy(
  signedData.locale === "en-us" ? "en-us" : "zh-cn",
);
$: rangeKeys = [
  ...baseCalendarGridWeeks.flatMap((week) => week.days.map((day) => day.key)),
  ...baseAgendaDays.map((day) => day.key),
].sort();
$: requestKey =
  signedData.navStats.user.id === ownerId &&
  hasWorkspaceSubscriptions(signedData) &&
  rangeKeys.length
    ? `${ownerId}:${signedData.locale}:${rangeKeys[0]}:${rangeKeys[rangeKeys.length - 1]}`
    : "";
$: if (browser && requestKey !== requestedRange) {
  requestedRange = requestKey;
  youngController?.abort();
  youngItems = [];
  youngFailed = false;
  youngLoading = Boolean(requestKey);
  if (requestKey)
    void loadYoung(ownerId, rangeKeys[0], rangeKeys[rangeKeys.length - 1]);
}
async function loadYoung(requestOwnerId: string, from: string, to: string) {
  const controller = new AbortController();
  youngController = controller;
  youngOwnerId = requestOwnerId;
  try {
    const items = await fetchPersonalCalendar(from, to, controller.signal);
    if (
      !controller.signal.aborted &&
      signedData.navStats.user.id === requestOwnerId &&
      $shellViewer.viewer?.id === requestOwnerId
    )
      youngItems = items.filter((item) => item.type === "young_event");
  } catch {
    if (
      !controller.signal.aborted &&
      signedData.navStats.user.id === requestOwnerId &&
      $shellViewer.viewer?.id === requestOwnerId
    )
      youngFailed = true;
  } finally {
    if (
      !controller.signal.aborted &&
      signedData.navStats.user.id === requestOwnerId &&
      $shellViewer.viewer?.id === requestOwnerId
    )
      youngLoading = false;
  }
}
onDestroy(() => youngController?.abort());
$: calendarGridWeeks = baseCalendarGridWeeks.map((week) => ({
  ...week,
  days: week.days.map((day) => ({
    ...day,
    events: [...day.events, ...personalItemsForDay(visibleYoungItems, day.key)],
  })),
}));
$: agendaDays = baseAgendaDays.map((day) => ({
  ...day,
  events: [
    ...day.events,
    ...personalItemsForDay(visibleYoungItems, day.key),
  ].sort((a, b) => a.sort - b.sort),
}));
</script>

<section class="grid gap-4">
  {#if signedData.navStats.user.id !== ownerId}
    <p role="status">{activityCopy.youngEvents.workspace.loading}</p>
  {:else if !hasWorkspaceSubscriptions(signedData)}
    <PersonalActivityCalendar copy={activityCopy} locale={signedData.locale} {ownerId} />
  {:else}
    <Button class="justify-self-start" href="/workspace/subscriptions/activities" variant="link">{activityCopy.youngEvents.workspace.manage}</Button>
    {#if youngLoading}<p role="status">{activityCopy.youngEvents.workspace.loading}</p>{/if}
    {#if youngFailed}<p role="alert">{activityCopy.youngEvents.workspace.failed}</p><Button variant="outline" onclick={() => requestedRange = ""}>{activityCopy.youngEvents.workspace.retry}</Button>{/if}
    <CalendarTabToolbar
      {addDays}
      {addMonths}
      {calendarData}
      {calendarDay}
      {calendarMonth}
      {calendarSemesterIndex}
      {calendarView}
      {calendarWeekStart}
      {agendaWeekStart}
      {commonCopy}
      {workspaceCopy}
      {formatMessage}
      {sectionCopy}
      {setCalendarDay}
      {setCalendarMonth}
      {setCalendarSemester}
      {setCalendarView}
      {setCalendarWeek}
      {signedData}
      {subscriptionsCopy}
    />

    {#if calendarData && calendarData.semesterWeeks.length > 0}
      {#key `${calendarView}-${calendarDay}-${calendarMonth}-${calendarWeekStart}-${calendarSemesterId ?? ""}`}
        <div class={calendarView === "day" ? "" : "md:hidden"}>
          <CalendarAgenda
            days={agendaDays}
            emptyLabel={workspaceCopy.calendarAgendaEmpty}
            label={calendarView === "day" ? workspaceCopy.calendarDayAgendaLabel : workspaceCopy.calendarAgendaLabel}
            todayLabel={workspaceCopy.todayAction}
          />
        </div>
        {#if calendarView !== "day"}
        <div class="hidden md:block" data-testid="workspace-calendar-grid">
          <CalendarGrid
            weeks={calendarGridWeeks}
            weekdays={calendarWeekdayLabels}
            weekHeaderLabel={sectionCopy.weekLabel}
            showWeekLabels={true}
            variant={calendarView === "week" ? "week" : "month"}
            minWidth="760px"
            eventLimit={calendarView === "week" ? 8 : 4}
            moreLabel={(count) =>
              formatMessage(workspaceCopy.moreItems, {
                count: String(count),
              })}
          />
        </div>
        {/if}
      {/key}
    {:else}
      <Empty.Root class="items-start text-left">
        <Empty.Header class="items-start text-left">
          <Empty.Title>{subscriptionsCopy.calendarEmpty}</Empty.Title>
        </Empty.Header>
      </Empty.Root>
    {/if}
  {/if}
</section>
