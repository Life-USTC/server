<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import { cn } from "$lib/utils.js";
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
  aria-current={day.isToday ? "date" : undefined}
  class={cn(
    "border-border p-2",
    variant === "week" ? "min-h-56 border-r" : "min-h-32 border-r border-b",
    isLastDay ? "border-r-0" : undefined,
    day.isToday ? "ring-1 ring-primary ring-inset" : undefined,
    day.isMuted ? "bg-muted/40 text-muted-foreground" : "bg-background",
  )}
>
  <div class="flex items-start justify-between gap-2">
    <div>
      <div class="font-medium text-xs">{day.label}</div>
      {#if day.sublabel}
        <div class="text-muted-foreground text-xs">{day.sublabel}</div>
      {/if}
    </div>
    {#if day.events.length > 0}
      <Badge class="h-5 min-w-5 px-1" variant="outline">
        {day.events.length}
      </Badge>
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
        <span class="text-muted-foreground text-xs">{emptyLabel}</span>
      {/if}
    {/each}
    {#if day.events.length > eventLimit}
      <span class="text-muted-foreground text-xs">
        {moreLabel(day.events.length - eventLimit)}
      </span>
    {/if}
  </div>
</div>
