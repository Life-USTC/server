<script lang="ts">
import * as Card from "$lib/components/ui/card/index.js";

type SectionMiniCalendarCopy = {
  calendarMiniDescription: string;
  classLegend: string;
  examLegend: string;
  weekdays: {
    shortFriday: string;
    shortMonday: string;
    shortSaturday: string;
    shortSunday: string;
    shortThursday: string;
    shortTuesday: string;
    shortWednesday: string;
  };
};

export let calendarExamDateKeys: Set<string>;
export let calendarMonthDays: Date[];
export let calendarMonthLabel: string;
export let calendarScheduleDateKeys: Set<string>;
export let dateKey: (value: string | Date | null | undefined) => string | null;
export let isSameMonth: (day: Date, monthStart: Date) => boolean;
export let sectionCopy: SectionMiniCalendarCopy;
export let todayCalendarKey: string | null;
export let visibleCalendarMonth: Date;
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="text-sm">{calendarMonthLabel}</Card.Title>
    <Card.Description>{sectionCopy.calendarMiniDescription}</Card.Description>
  </Card.Header>
  <Card.Content class="grid gap-2">
    <div class="grid grid-cols-7 gap-1 text-center text-base-content/60 text-[0.65rem]">
      {#each [
        sectionCopy.weekdays.shortSunday,
        sectionCopy.weekdays.shortMonday,
        sectionCopy.weekdays.shortTuesday,
        sectionCopy.weekdays.shortWednesday,
        sectionCopy.weekdays.shortThursday,
        sectionCopy.weekdays.shortFriday,
        sectionCopy.weekdays.shortSaturday,
      ] as weekday}
        <div>{weekday.slice(0, 1)}</div>
      {/each}
    </div>
    <div class="grid grid-cols-7 gap-1">
      {#each calendarMonthDays as day}
        {@const dayKey = dateKey(day)}
        {@const hasClass = dayKey ? calendarScheduleDateKeys.has(dayKey) : false}
        {@const hasExam = dayKey ? calendarExamDateKeys.has(dayKey) : false}
        <div
          class={`flex min-h-10 flex-col items-center justify-center gap-1 rounded-md p-1 text-xs ${isSameMonth(day, visibleCalendarMonth) ? "text-base-content" : "text-base-content/40"}`}
        >
          <span class={dayKey === todayCalendarKey ? "underline decoration-base-content underline-offset-2" : ""}>
            {day.getDate()}
          </span>
          {#if isSameMonth(day, visibleCalendarMonth) && (hasClass || hasExam)}
            <span class="flex items-center gap-1">
              {#if hasClass}<span class="h-1.5 w-1.5 rounded-full bg-base-content"></span>{/if}
              {#if hasExam}<span class="h-1.5 w-1.5 rounded-full border border-base-content"></span>{/if}
            </span>
          {:else}
            <span class="h-1.5"></span>
          {/if}
        </div>
      {/each}
    </div>
    <div class="flex flex-wrap gap-3 border-base-300 border-t pt-2 text-base-content/60 text-xs">
      <span class="inline-flex items-center gap-1">
        <span class="h-1.5 w-1.5 rounded-full bg-base-content"></span>
        {sectionCopy.classLegend}
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="h-1.5 w-1.5 rounded-full border border-base-content"></span>
        {sectionCopy.examLegend}
      </span>
    </div>
  </Card.Content>
</Card.Root>
