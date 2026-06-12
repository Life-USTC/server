<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import type { DashboardCalendarControlsProps } from "./dashboard-calendar-component-types";
import type { FormatMessage } from "./dashboard-component-types";

export let addDays: DashboardCalendarControlsProps["addDays"];
export let addMonths: DashboardCalendarControlsProps["addMonths"];
export let calendarData: DashboardCalendarControlsProps["calendarData"];
export let calendarMonth: DashboardCalendarControlsProps["calendarMonth"];
export let calendarSemesterIndex: DashboardCalendarControlsProps["calendarSemesterIndex"];
export let calendarView: DashboardCalendarControlsProps["calendarView"];
export let calendarWeekStart: DashboardCalendarControlsProps["calendarWeekStart"];
export let commonCopy: DashboardCalendarControlsProps["commonCopy"];
export let dashboardCopy: DashboardCalendarControlsProps["dashboardCopy"];
export let formatMessage: FormatMessage;
export let sectionCopy: DashboardCalendarControlsProps["sectionCopy"];
export let setCalendarMonth: DashboardCalendarControlsProps["setCalendarMonth"];
export let setCalendarSemester: DashboardCalendarControlsProps["setCalendarSemester"];
export let setCalendarWeek: DashboardCalendarControlsProps["setCalendarWeek"];
</script>

{#if calendarData}
  {#if calendarView === "month"}
    <ButtonGroup.Root>
      <Button aria-label={sectionCopy.previousMonth} size="lg" type="button" variant="ghost" onclick={() => setCalendarMonth(addMonths(calendarMonth, -1))}>
        {commonCopy.previous}
      </Button>
      <span class="inline-flex h-9 items-center px-3 font-medium text-sm">{calendarMonth}</span>
      <Button aria-label={sectionCopy.nextMonth} size="lg" type="button" variant="ghost" onclick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
        {commonCopy.next}
      </Button>
    </ButtonGroup.Root>
  {:else if calendarView === "week"}
    <ButtonGroup.Root>
      <Button aria-label={dashboardCopy.calendarWeek.prev} size="lg" type="button" variant="ghost" onclick={() => setCalendarWeek(addDays(calendarWeekStart, -7))}>
        {commonCopy.previous}
      </Button>
      <span class="inline-flex h-9 items-center px-3 font-medium text-sm">
        {formatMessage(dashboardCopy.calendarWeek.current, { date: calendarWeekStart })}
      </span>
      <Button aria-label={dashboardCopy.calendarWeek.next} size="lg" type="button" variant="ghost" onclick={() => setCalendarWeek(addDays(calendarWeekStart, 7))}>
        {commonCopy.next}
      </Button>
    </ButtonGroup.Root>
  {:else}
    <ButtonGroup.Root>
      <Button
        aria-label={dashboardCopy.calendarSemesterPrev}
        disabled={calendarSemesterIndex(calendarData) <= 0}
        size="lg"
        type="button"
        variant="ghost"
        onclick={() => {
          const next = calendarData.calendarSemesterNavList[
            calendarSemesterIndex(calendarData) - 1
          ];
          if (next) setCalendarSemester(next.id);
        }}
      >
        {dashboardCopy.calendarSemesterPrev}
      </Button>
      <span class="inline-flex h-9 items-center px-3 font-medium text-sm">
        {calendarData.activeCalendarSemesterName ?? commonCopy.semesters}
      </span>
      <Button
        aria-label={dashboardCopy.calendarSemesterNext}
        disabled={calendarSemesterIndex(calendarData) >= calendarData.calendarSemesterNavList.length - 1}
        size="lg"
        type="button"
        variant="ghost"
        onclick={() => {
          const next = calendarData.calendarSemesterNavList[
            calendarSemesterIndex(calendarData) + 1
          ];
          if (next) setCalendarSemester(next.id);
        }}
      >
        {dashboardCopy.calendarSemesterNext}
      </Button>
    </ButtonGroup.Root>
  {/if}
{/if}
