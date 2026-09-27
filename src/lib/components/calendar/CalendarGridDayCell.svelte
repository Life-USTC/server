<script lang="ts">
import { cn } from "$lib/utils.js";
import CalendarEventChip from "./CalendarEventChip.svelte";
import type { CalendarGridWeek } from "./types";

type CalendarGridDay = CalendarGridWeek["days"][number];

export let day: CalendarGridDay;
export let density: "cards" | "lines" = "cards";
export let emptyLabel = "";
export let eventLimit = 5;
export let isLastDay = false;
export let moreLabel: (count: number) => string = (count) => `+${count}`;
export let variant: "week" | "month" = "week";
</script>

<div
  role="gridcell"
  aria-current={day.isToday ? "date" : undefined}
  class={cn(
    "border-border p-2",
    variant === "week"
      ? density === "lines"
        ? "min-h-36 border-r"
        : "min-h-56 border-r"
      : density === "lines"
        ? "min-h-24 border-r border-b"
        : "min-h-32 border-r border-b",
    isLastDay ? "border-r-0" : undefined,
    day.isToday ? "ring-1 ring-primary ring-inset" : undefined,
    day.isMuted ? "bg-muted/40 text-muted-foreground" : "bg-background",
  )}
>
  <div>
    {#if day.moreHref}
      <a class="font-medium text-xs hover:underline" href={day.moreHref}>{day.label}</a>
    {:else}
      <div class="font-medium text-xs">{day.label}</div>
    {/if}
    {#if day.sublabel}
      <div class="text-muted-foreground text-xs">{day.sublabel}</div>
    {/if}
  </div>
  <div class={density === "lines" ? "mt-1 grid" : "mt-3 grid gap-1.5"}>
    {#each day.events.slice(0, eventLimit) as event}
      {#if density === "lines"}
        <a
          class="block truncate rounded-sm px-1 text-xs leading-5 hover:bg-muted"
          href={event.href}
          title={event.title || event.label}
        >
          {#if event.meta}<span class="text-muted-foreground">{event.meta}</span>{" "}{/if}{event.label}
        </a>
      {:else}
        <CalendarEventChip
          href={event.href}
          label={event.label}
          badge={event.badge}
          title={event.title}
          tooltip={event.tooltip}
          tooltipDetail={event.tooltipDetail}
          meta={event.meta}
          detail={event.detail}
          tone={event.tone}
          done={event.done}
        />
      {/if}
    {:else}
      {#if emptyLabel}
        <span class="text-muted-foreground text-xs">{emptyLabel}</span>
      {/if}
    {/each}
    {#if day.events.length > eventLimit}
      {#if day.moreHref}
        <a class="text-muted-foreground text-xs underline" href={day.moreHref}>{moreLabel(day.events.length - eventLimit)}</a>
      {:else}
        <span class="text-muted-foreground text-xs">{moreLabel(day.events.length - eventLimit)}</span>
      {/if}
    {/if}
  </div>
</div>
