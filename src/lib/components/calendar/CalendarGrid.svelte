<script lang="ts">
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { cn } from "$lib/utils.js";
import CalendarGridDayCell from "./CalendarGridDayCell.svelte";
import type { CalendarGridWeek } from "./types";

export let weeks: CalendarGridWeek[] = [];
export let weekdays: string[] = [];
export let weekHeaderLabel = "";
export let showWeekLabels = false;
export let variant: "week" | "month" = "week";
export let minWidth = "840px";
export let eventLimit = 5;
export let emptyLabel = "";
export let framed = true;
export let moreLabel: (count: number) => string = (count) => `+${count}`;

function gridColumns() {
  return showWeekLabels
    ? "grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]"
    : "grid-cols-7";
}
</script>

<ScrollArea orientation="horizontal">
  <div
    class={cn(
      "overflow-hidden bg-background",
      framed ? "rounded-xl border border-border" : undefined,
    )}
    style={`min-width: ${minWidth};`}
  >
    {#if weekdays.length > 0}
      <div class={cn("grid border-border border-b bg-muted/50 text-center text-muted-foreground text-xs", gridColumns())}>
        {#if showWeekLabels}
          <div class="border-border border-r px-2 py-2 font-medium">{weekHeaderLabel}</div>
        {/if}
        {#each weekdays as weekday}
          <div class="px-2 py-2 font-medium">{weekday}</div>
        {/each}
      </div>
    {/if}

    {#each weeks as week}
      <div class={cn("grid", gridColumns())}>
        {#if showWeekLabels}
          <div class="flex items-center justify-center border-border border-r border-b bg-muted/35 px-1 py-2 text-center text-muted-foreground text-[0.65rem]">
            {#if week.label}
              <span class="[text-orientation:mixed] [writing-mode:vertical-rl]">{week.label}</span>
            {/if}
          </div>
        {/if}
        {#each week.days as day, dayIndex}
          <CalendarGridDayCell
            {day}
            {emptyLabel}
            {eventLimit}
            isLastDay={dayIndex === week.days.length - 1}
            {moreLabel}
            {variant}
          />
        {/each}
      </div>
    {/each}
  </div>
</ScrollArea>
