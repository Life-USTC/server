<script lang="ts">
import CalendarEventChip from "./CalendarEventChip.svelte";
import type { CalendarGridWeek } from "./types";

type CalendarGridDay = CalendarGridWeek["days"][number];

export let day: CalendarGridDay;
export let emptyLabel = "";
export let eventLimit = 5;
export let isLastDay = false;
export let moreLabel: (count: number) => string = (count) => `+${count}`;
export let variant: "week" | "month" = "week";
</script>

<div
  class={`border-base-300 p-2 ${variant === "week" ? "min-h-56 border-r" : "min-h-32 border-r border-b"} ${isLastDay ? "border-r-0" : ""} ${day.isToday ? "ring-1 ring-primary ring-inset" : ""} ${day.isMuted ? "bg-base-200/40 text-base-content/45" : "bg-base-100"}`}
>
  <div class="flex items-start justify-between gap-2">
    <div>
      <div class="font-medium text-xs">{day.label}</div>
      {#if day.sublabel}
        <div class="text-base-content/55 text-xs">{day.sublabel}</div>
      {/if}
    </div>
    {#if day.events.length > 0}
      <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-base-200 px-1.5 font-medium text-base-content/60 text-xs">
        {day.events.length}
      </span>
    {/if}
  </div>
  <div class="mt-3 grid gap-1.5">
    {#each day.events.slice(0, eventLimit) as event}
      <CalendarEventChip
        href={event.href ?? "#"}
        label={event.label}
        title={event.title}
        tooltip={event.tooltip}
        meta={event.meta}
        detail={event.detail}
        tone={event.tone}
        done={event.done}
      />
    {:else}
      {#if emptyLabel}
        <span class="text-base-content/45 text-xs">{emptyLabel}</span>
      {/if}
    {/each}
    {#if day.events.length > eventLimit}
      <span class="text-base-content/55 text-xs">
        {moreLabel(day.events.length - eventLimit)}
      </span>
    {/if}
  </div>
</div>
