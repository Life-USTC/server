<script lang="ts">
import type { DashboardRootCopy } from "@/features/dashboard/lib/dashboard-controller-helpers";
import CalendarTab from "./CalendarTab.svelte";
import type { DashboardCalendarTabProps } from "./dashboard-calendar-component-types";
import type { FormatMessage } from "./dashboard-component-types";

export let addDays: DashboardCalendarTabProps["addDays"];
export let addMonths: DashboardCalendarTabProps["addMonths"];
export let calendarData: DashboardCalendarTabProps["calendarData"];
export let calendarEventParts: DashboardCalendarTabProps["calendarEventParts"];
export let calendarEventsForDay: DashboardCalendarTabProps["calendarEventsForDay"];
export let calendarExamDetail: DashboardCalendarTabProps["calendarExamDetail"];
export let calendarHomeworkDetail: DashboardCalendarTabProps["calendarHomeworkDetail"];
export let calendarHomeworkHref: DashboardCalendarTabProps["calendarHomeworkHref"];
export let calendarMonth: DashboardCalendarTabProps["calendarMonth"];
export let calendarSemesterId: DashboardCalendarTabProps["calendarSemesterId"];
export let calendarSemesterIndex: DashboardCalendarTabProps["calendarSemesterIndex"];
export let calendarSessionDetail: DashboardCalendarTabProps["calendarSessionDetail"];
export let calendarTodoDetail: DashboardCalendarTabProps["calendarTodoDetail"];
export let calendarView: DashboardCalendarTabProps["calendarView"];
export let calendarWeekLabel: DashboardCalendarTabProps["calendarWeekLabel"];
export let calendarWeekStart: DashboardCalendarTabProps["calendarWeekStart"];
export let calendarWeekdayLabels: DashboardCalendarTabProps["calendarWeekdayLabels"];
export let commonCopy: DashboardCalendarTabProps["commonCopy"];
export let copy: DashboardRootCopy;
export let copyCalendarLink: DashboardCalendarTabProps["copyCalendarLink"];
export let dashboardCopy: DashboardCalendarTabProps["dashboardCopy"];
export let dashboardTabHref: DashboardCalendarTabProps["dashboardTabHref"];
export let formatMessage: FormatMessage;
export let monthWeeks: DashboardCalendarTabProps["monthWeeks"];
export let sectionCopy: DashboardCalendarTabProps["sectionCopy"];
export let sessionHref: DashboardCalendarTabProps["sessionHref"];
export let setCalendarMonth: DashboardCalendarTabProps["setCalendarMonth"];
export let setCalendarSemester: DashboardCalendarTabProps["setCalendarSemester"];
export let setCalendarView: DashboardCalendarTabProps["setCalendarView"];
export let setCalendarWeek: DashboardCalendarTabProps["setCalendarWeek"];
export let signedData: DashboardCalendarTabProps["signedData"];
export let subscriptionsCopy: DashboardCalendarTabProps["subscriptionsCopy"];
</script>

<CalendarTab
  {copy}
  {commonCopy}
  {dashboardCopy}
  {sectionCopy}
  {subscriptionsCopy}
  {calendarWeekdayLabels}
  {signedData}
  {dashboardTabHref}
  {formatMessage}
  {copyCalendarLink}
  {sessionHref}
  {setCalendarView}
  {setCalendarMonth}
  {setCalendarWeek}
  {setCalendarSemester}
  {addDays}
  {addMonths}
  {monthWeeks}
  {calendarEventsForDay}
  {calendarWeekLabel}
  {calendarEventParts}
  {calendarHomeworkHref}
  {calendarSessionDetail}
  {calendarExamDetail}
  {calendarHomeworkDetail}
  {calendarTodoDetail}
  {calendarSemesterIndex}
  {calendarView}
  {calendarMonth}
  {calendarWeekStart}
  {calendarSemesterId}
  {calendarData}
/>
