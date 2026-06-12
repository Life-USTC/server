<script lang="ts">
import { buildDashboardCalendarGridWeeks } from "@/features/dashboard/lib/calendar-grid";
import { hasDashboardSubscriptions } from "@/features/dashboard/lib/dashboard-subscription-state";
import CalendarGrid from "$lib/components/calendar/CalendarGrid.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import CalendarTabToolbar from "./CalendarTabToolbar.svelte";
import DashboardNoSubscriptionsState from "./DashboardNoSubscriptionsState.svelte";
import type { DashboardCalendarTabProps } from "./dashboard-calendar-component-types";
import type { FormatMessage } from "./dashboard-component-types";

export let copy: DashboardCalendarTabProps["copy"];
export let commonCopy: DashboardCalendarTabProps["commonCopy"];
export let dashboardCopy: DashboardCalendarTabProps["dashboardCopy"];
export let sectionCopy: DashboardCalendarTabProps["sectionCopy"];
export let subscriptionsCopy: DashboardCalendarTabProps["subscriptionsCopy"];
export let calendarWeekdayLabels: DashboardCalendarTabProps["calendarWeekdayLabels"];
export let signedData: DashboardCalendarTabProps["signedData"];

export let dashboardTabHref: DashboardCalendarTabProps["dashboardTabHref"];
export let formatMessage: FormatMessage;
export let copyCalendarLink: DashboardCalendarTabProps["copyCalendarLink"];
export let sessionHref: DashboardCalendarTabProps["sessionHref"];

export let setCalendarView: DashboardCalendarTabProps["setCalendarView"];
export let setCalendarMonth: DashboardCalendarTabProps["setCalendarMonth"];
export let setCalendarWeek: DashboardCalendarTabProps["setCalendarWeek"];
export let setCalendarSemester: DashboardCalendarTabProps["setCalendarSemester"];
export let addDays: DashboardCalendarTabProps["addDays"];
export let addMonths: DashboardCalendarTabProps["addMonths"];
export let monthWeeks: DashboardCalendarTabProps["monthWeeks"];
export let calendarEventsForDay: DashboardCalendarTabProps["calendarEventsForDay"];
export let calendarWeekLabel: DashboardCalendarTabProps["calendarWeekLabel"];
export let calendarEventParts: DashboardCalendarTabProps["calendarEventParts"];
export let calendarHomeworkHref: DashboardCalendarTabProps["calendarHomeworkHref"];
export let calendarSessionDetail: DashboardCalendarTabProps["calendarSessionDetail"];
export let calendarExamDetail: DashboardCalendarTabProps["calendarExamDetail"];
export let calendarHomeworkDetail: DashboardCalendarTabProps["calendarHomeworkDetail"];
export let calendarTodoDetail: DashboardCalendarTabProps["calendarTodoDetail"];
export let calendarSemesterIndex: DashboardCalendarTabProps["calendarSemesterIndex"];

export let calendarView: DashboardCalendarTabProps["calendarView"];
export let calendarMonth: DashboardCalendarTabProps["calendarMonth"];
export let calendarWeekStart: DashboardCalendarTabProps["calendarWeekStart"];
export let calendarSemesterId: DashboardCalendarTabProps["calendarSemesterId"];
export let calendarData: DashboardCalendarTabProps["calendarData"];

let calendarGridWeeks: ReturnType<typeof buildDashboardCalendarGridWeeks> = [];

$: calendarGridWeeks = calendarData
  ? buildDashboardCalendarGridWeeks({
      addDays,
      calendar: calendarData,
      calendarEventParts,
      calendarEventsForDay,
      calendarExamDetail,
      calendarHomeworkDetail,
      calendarHomeworkHref,
      calendarSessionDetail,
      calendarTodoDetail,
      calendarWeekLabel,
      dashboardTabHref,
      examLabel: copy.CalendarEventCard.exam,
      month: calendarMonth,
      monthWeeks,
      sectionWeekLabel: sectionCopy.weekLabel,
      sessionHref,
      view: calendarView,
      weekStart: calendarWeekStart,
    })
  : [];
</script>

<section class="grid gap-4">
  {#if !hasDashboardSubscriptions(signedData)}
    <DashboardNoSubscriptionsState
      title={subscriptionsCopy.noSubscriptions}
      description={subscriptionsCopy.noSubscriptionsDescription}
      actions={[
        { href: "/sections", label: subscriptionsCopy.browseSections },
        { href: "/courses", label: subscriptionsCopy.browseCourses, variant: "outline" },
      ]}
    />
  {:else}
    <CalendarTabToolbar
      {addDays}
      {addMonths}
      {calendarData}
      {calendarMonth}
      {calendarSemesterIndex}
      {calendarView}
      {calendarWeekStart}
      {commonCopy}
      {copyCalendarLink}
      {dashboardCopy}
      {formatMessage}
      {sectionCopy}
      {setCalendarMonth}
      {setCalendarSemester}
      {setCalendarView}
      {setCalendarWeek}
      {signedData}
      {subscriptionsCopy}
    />

    {#if calendarData && calendarData.semesterWeeks.length > 0}
      {#key `${calendarView}-${calendarMonth}-${calendarWeekStart}-${calendarSemesterId ?? ""}`}
        <CalendarGrid
          weeks={calendarGridWeeks}
          weekdays={calendarWeekdayLabels}
          weekHeaderLabel={sectionCopy.weekLabel}
          showWeekLabels={true}
          variant={calendarView === "week" ? "week" : "month"}
          minWidth="760px"
          eventLimit={calendarView === "week" ? 8 : 4}
          moreLabel={(count) =>
            formatMessage(dashboardCopy.moreItems, {
              count: String(count),
            })}
        />
      {/key}
    {:else}
      <Alert>{subscriptionsCopy.calendarEmpty}</Alert>
    {/if}
  {/if}
</section>
