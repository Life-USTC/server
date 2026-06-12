<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as Tabs from "$lib/components/ui/tabs/index.js";
import CalendarTabNavigationControls from "./CalendarTabNavigationControls.svelte";
import type { DashboardCalendarTabProps } from "./dashboard-calendar-component-types";
import type { FormatMessage } from "./dashboard-component-types";

export let addDays: DashboardCalendarTabProps["addDays"];
export let addMonths: DashboardCalendarTabProps["addMonths"];
export let calendarData: DashboardCalendarTabProps["calendarData"];
export let calendarMonth: DashboardCalendarTabProps["calendarMonth"];
export let calendarSemesterIndex: DashboardCalendarTabProps["calendarSemesterIndex"];
export let calendarView: DashboardCalendarTabProps["calendarView"];
export let calendarWeekStart: DashboardCalendarTabProps["calendarWeekStart"];
export let commonCopy: DashboardCalendarTabProps["commonCopy"];
export let copyCalendarLink: DashboardCalendarTabProps["copyCalendarLink"];
export let dashboardCopy: DashboardCalendarTabProps["dashboardCopy"];
export let formatMessage: FormatMessage;
export let sectionCopy: DashboardCalendarTabProps["sectionCopy"];
export let setCalendarMonth: DashboardCalendarTabProps["setCalendarMonth"];
export let setCalendarSemester: DashboardCalendarTabProps["setCalendarSemester"];
export let setCalendarView: DashboardCalendarTabProps["setCalendarView"];
export let setCalendarWeek: DashboardCalendarTabProps["setCalendarWeek"];
export let signedData: DashboardCalendarTabProps["signedData"];
export let subscriptionsCopy: DashboardCalendarTabProps["subscriptionsCopy"];
</script>

<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
  <div class="flex flex-wrap items-center gap-2 md:justify-start">
    <Tabs.List aria-label={dashboardCopy.nav.calendar.title}>
      <Tabs.Button selected={calendarView === "semester"} onclick={() => setCalendarView("semester")}>
        {dashboardCopy.calendarViewSemester}
      </Tabs.Button>
      <Tabs.Button selected={calendarView === "month"} onclick={() => setCalendarView("month")}>
        {dashboardCopy.calendarViewMonth}
      </Tabs.Button>
      <Tabs.Button selected={calendarView === "week"} onclick={() => setCalendarView("week")}>
        {dashboardCopy.calendarViewWeek}
      </Tabs.Button>
    </Tabs.List>
    <CalendarTabNavigationControls
      {addDays}
      {addMonths}
      {calendarData}
      {calendarMonth}
      {calendarSemesterIndex}
      {calendarView}
      {calendarWeekStart}
      {commonCopy}
      {dashboardCopy}
      {formatMessage}
      {sectionCopy}
      {setCalendarMonth}
      {setCalendarSemester}
      {setCalendarWeek}
    />
  </div>
  <div class="flex flex-wrap items-center gap-2 md:justify-end">
    {#if signedData.calendarSubscriptionUrl}
      <Button
        class="min-w-28"
        data-copy-url={signedData.calendarSubscriptionUrl}
        onclick={copyCalendarLink}
        size="lg"
        type="button"
        variant="outline"
      >
        {subscriptionsCopy.iCalLink}
      </Button>
    {/if}
  </div>
</div>
