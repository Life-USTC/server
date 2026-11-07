<script lang="ts">
import ChevronLeft from "@lucide/svelte/icons/chevron-left";
import ChevronRight from "@lucide/svelte/icons/chevron-right";
import { Button } from "#lib/components/ui/button/index.js";
import * as ButtonGroup from "#lib/components/ui/button-group/index.js";
import { Input } from "#lib/components/ui/input/index.js";
import { weekStartFor } from "@/features/workspace/lib/calendar";
import type { WorkspaceCalendarControlsProps } from "./workspace-calendar-component-types";
import type { FormatMessage } from "./workspace-component-types";

export let addDays: WorkspaceCalendarControlsProps["addDays"];
export let addMonths: WorkspaceCalendarControlsProps["addMonths"];
export let calendarData: WorkspaceCalendarControlsProps["calendarData"];
export let calendarDay: WorkspaceCalendarControlsProps["calendarDay"];
export let calendarMonth: WorkspaceCalendarControlsProps["calendarMonth"];
export let calendarSemesterIndex: WorkspaceCalendarControlsProps["calendarSemesterIndex"];
export let calendarView: WorkspaceCalendarControlsProps["calendarView"];
export let calendarWeekStart: WorkspaceCalendarControlsProps["calendarWeekStart"];
export let commonCopy: WorkspaceCalendarControlsProps["commonCopy"];
export let workspaceCopy: WorkspaceCalendarControlsProps["workspaceCopy"];
export let formatMessage: FormatMessage;
export let sectionCopy: WorkspaceCalendarControlsProps["sectionCopy"];
export let setCalendarDay: WorkspaceCalendarControlsProps["setCalendarDay"];
export let setCalendarMonth: WorkspaceCalendarControlsProps["setCalendarMonth"];
export let setCalendarSemester: WorkspaceCalendarControlsProps["setCalendarSemester"];
export let setCalendarWeek: WorkspaceCalendarControlsProps["setCalendarWeek"];

$: previousLabel =
  calendarView === "day"
    ? workspaceCopy.calendarDay.prev
    : calendarView === "week"
      ? workspaceCopy.calendarWeek.prev
      : calendarView === "month"
        ? sectionCopy.previousMonth
        : workspaceCopy.calendarSemesterPrev;
$: nextLabel =
  calendarView === "day"
    ? workspaceCopy.calendarDay.next
    : calendarView === "week"
      ? workspaceCopy.calendarWeek.next
      : calendarView === "month"
        ? sectionCopy.nextMonth
        : workspaceCopy.calendarSemesterNext;
$: semesterIndex = calendarData ? calendarSemesterIndex(calendarData) : -1;
function move(direction: number) {
  if (!calendarData) return;
  if (calendarView === "day") setCalendarDay(addDays(calendarDay, direction));
  else if (calendarView === "week")
    setCalendarWeek(addDays(calendarWeekStart, direction * 7));
  else if (calendarView === "month")
    setCalendarMonth(addMonths(calendarMonth, direction));
  else {
    const semester =
      calendarData.calendarSemesterNavList[semesterIndex + direction];
    if (semester) setCalendarSemester(semester.id);
  }
}
function today() {
  if (!calendarData) return;
  if (calendarView === "day") setCalendarDay(calendarData.todayDate);
  else if (calendarView === "week")
    setCalendarWeek(weekStartFor(calendarData.todayDate));
  else if (calendarView === "month")
    setCalendarMonth(calendarData.todayDate.slice(0, 7));
  else setCalendarSemester(null);
}
</script>

{#if calendarData}
  <div class="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
    <ButtonGroup.Root aria-label={workspaceCopy.calendarNavigationLabel}>
      <Button aria-label={previousLabel} class="size-11" size="icon" type="button" variant="outline" disabled={calendarView === "semester" && semesterIndex <= 0} onclick={() => move(-1)}><ChevronLeft data-icon="inline-start" /></Button>
      <Button class="h-11 min-w-11 px-3 md:min-w-11" type="button" variant="outline" onclick={today}>{workspaceCopy.todayAction}</Button>
      <Button aria-label={nextLabel} class="size-11" size="icon" type="button" variant="outline" disabled={calendarView === "semester" && semesterIndex >= calendarData.calendarSemesterNavList.length - 1} onclick={() => move(1)}><ChevronRight data-icon="inline-start" /></Button>
    </ButtonGroup.Root>
    {#if calendarView === "day"}
      <Input aria-label={workspaceCopy.calendarDay.label} type="date" value={calendarDay} class="h-11 w-auto max-w-full" onchange={(event) => { if (event.currentTarget.value) setCalendarDay(event.currentTarget.value); }} />
    {:else}
      <p class="min-w-0 break-words text-sm text-muted-foreground" aria-live="polite">
        {calendarView === "month" ? calendarMonth : calendarView === "week" ? formatMessage(workspaceCopy.calendarWeek.current, { date: calendarWeekStart }) : calendarData.activeCalendarSemesterName ?? commonCopy.semesters}
      </p>
    {/if}
  </div>
{/if}
