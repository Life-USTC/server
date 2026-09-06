<script lang="ts">
import { Button } from "$lib/components/ui/button/index.js";
import * as ButtonGroup from "$lib/components/ui/button-group/index.js";
import type { WorkspaceCalendarControlsProps } from "./workspace-calendar-component-types";
import type { FormatMessage } from "./workspace-component-types";

export let addDays: WorkspaceCalendarControlsProps["addDays"];
export let addMonths: WorkspaceCalendarControlsProps["addMonths"];
export let calendarData: WorkspaceCalendarControlsProps["calendarData"];
export let calendarMonth: WorkspaceCalendarControlsProps["calendarMonth"];
export let calendarSemesterIndex: WorkspaceCalendarControlsProps["calendarSemesterIndex"];
export let calendarView: WorkspaceCalendarControlsProps["calendarView"];
export let calendarWeekStart: WorkspaceCalendarControlsProps["calendarWeekStart"];
export let commonCopy: WorkspaceCalendarControlsProps["commonCopy"];
export let workspaceCopy: WorkspaceCalendarControlsProps["workspaceCopy"];
export let formatMessage: FormatMessage;
export let sectionCopy: WorkspaceCalendarControlsProps["sectionCopy"];
export let setCalendarMonth: WorkspaceCalendarControlsProps["setCalendarMonth"];
export let setCalendarSemester: WorkspaceCalendarControlsProps["setCalendarSemester"];
export let setCalendarWeek: WorkspaceCalendarControlsProps["setCalendarWeek"];
</script>

{#if calendarData}
  {#if calendarView === "month"}
    <ButtonGroup.Root>
      <Button aria-label={sectionCopy.previousMonth} type="button" variant="outline" onclick={() => setCalendarMonth(addMonths(calendarMonth, -1))}>
        {commonCopy.previous}
      </Button>
      <ButtonGroup.Text class="h-8">{calendarMonth}</ButtonGroup.Text>
      <Button aria-label={sectionCopy.nextMonth} type="button" variant="outline" onclick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
        {commonCopy.next}
      </Button>
    </ButtonGroup.Root>
  {:else if calendarView === "week"}
    <ButtonGroup.Root>
      <Button aria-label={workspaceCopy.calendarWeek.prev} type="button" variant="outline" onclick={() => setCalendarWeek(addDays(calendarWeekStart, -7))}>
        {commonCopy.previous}
      </Button>
      <ButtonGroup.Text class="h-8">
        {formatMessage(workspaceCopy.calendarWeek.current, { date: calendarWeekStart })}
      </ButtonGroup.Text>
      <Button aria-label={workspaceCopy.calendarWeek.next} type="button" variant="outline" onclick={() => setCalendarWeek(addDays(calendarWeekStart, 7))}>
        {commonCopy.next}
      </Button>
    </ButtonGroup.Root>
  {:else}
    <ButtonGroup.Root>
      <Button
        aria-label={workspaceCopy.calendarSemesterPrev}
        disabled={calendarSemesterIndex(calendarData) <= 0}
        type="button"
        variant="outline"
        onclick={() => {
          const next = calendarData.calendarSemesterNavList[
            calendarSemesterIndex(calendarData) - 1
          ];
          if (next) setCalendarSemester(next.id);
        }}
      >
        {workspaceCopy.calendarSemesterPrev}
      </Button>
      <ButtonGroup.Text class="h-8">
        {calendarData.activeCalendarSemesterName ?? commonCopy.semesters}
      </ButtonGroup.Text>
      <Button
        aria-label={workspaceCopy.calendarSemesterNext}
        disabled={calendarSemesterIndex(calendarData) >= calendarData.calendarSemesterNavList.length - 1}
        type="button"
        variant="outline"
        onclick={() => {
          const next = calendarData.calendarSemesterNavList[
            calendarSemesterIndex(calendarData) + 1
          ];
          if (next) setCalendarSemester(next.id);
        }}
      >
        {workspaceCopy.calendarSemesterNext}
      </Button>
    </ButtonGroup.Root>
  {/if}
{/if}
