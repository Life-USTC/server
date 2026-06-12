<script lang="ts">
import CalendarGrid from "$lib/components/calendar/CalendarGrid.svelte";
import type { CalendarGridWeek } from "$lib/components/calendar/types";
import ChevronLeftIcon from "$lib/components/icons/chevron-left.svelte";
import ChevronRightIcon from "$lib/components/icons/chevron-right.svelte";
import { Button } from "$lib/components/ui/button/index.js";
import type { SectionCalendarCopy } from "./section-calendar-tab-types";

export let calendarGridWeeks: CalendarGridWeek[];
export let calendarMonthLabel: string;
export let calendarMonthOffset: number;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let sectionCopy: SectionCalendarCopy;
</script>

<section class="overflow-hidden rounded-md border border-base-300 bg-base-100">
  <div class="flex flex-wrap items-center justify-between gap-3 border-base-300 border-b px-4 py-3">
    <div>
      <h3 class="font-semibold">{calendarMonthLabel}</h3>
    </div>
    <div class="flex gap-2">
      <Button
        aria-label={sectionCopy.previousMonth}
        size="sm"
        type="button"
        variant="outline"
        onclick={() => (calendarMonthOffset -= 1)}
      >
        <ChevronLeftIcon />
        <span>{sectionCopy.previousMonth}</span>
      </Button>
      <Button
        size="sm"
        type="button"
        variant="outline"
        onclick={() => (calendarMonthOffset = 0)}
      >
        {sectionCopy.today}
      </Button>
      <Button
        aria-label={sectionCopy.nextMonth}
        size="sm"
        type="button"
        variant="outline"
        onclick={() => (calendarMonthOffset += 1)}
      >
        <span>{sectionCopy.nextMonth}</span>
        <ChevronRightIcon />
      </Button>
    </div>
  </div>
  <CalendarGrid
    weeks={calendarGridWeeks}
    weekdays={[
      sectionCopy.weekdays.shortSunday,
      sectionCopy.weekdays.shortMonday,
      sectionCopy.weekdays.shortTuesday,
      sectionCopy.weekdays.shortWednesday,
      sectionCopy.weekdays.shortThursday,
      sectionCopy.weekdays.shortFriday,
      sectionCopy.weekdays.shortSaturday,
    ]}
    weekHeaderLabel={sectionCopy.weekLabel}
    showWeekLabels={true}
    variant="month"
    eventLimit={3}
    framed={false}
    moreLabel={(count) =>
      formatMessage(sectionCopy.moreEvents, {
        count: String(count),
      })}
  />
</section>
