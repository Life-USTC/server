<script lang="ts">
import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
import { cn } from "$lib/utils.js";
import CalendarEventChip from "./CalendarEventChip.svelte";

type CalendarWeekEvent = {
  done?: boolean;
  href?: string;
  label: string;
  title?: string;
  tooltip?: string;
  tooltipDetail?: string;
  meta?: string;
  detail?: string;
  tone?: "primary" | "warning" | "success" | "info" | "error" | "neutral";
};

type CalendarWeekDay = {
  key: string;
  label: string;
  sublabel?: string;
  isToday?: boolean;
  events: CalendarWeekEvent[];
};

export let days: CalendarWeekDay[] = [];
export let minWidth = "840px";
export let eventLimit = 5;
export let emptyLabel = "";
export let moreLabel: (count: number) => string = (count) => `+${count}`;
</script>

<ScrollArea orientation="horizontal">
  <div class="grid grid-cols-7 gap-3" style={`min-width: ${minWidth};`}>
    {#each days as day}
      <section
        class={cn(
          "min-h-44 border-t-2 pt-2",
          day.isToday ? "border-primary" : "border-border",
        )}
      >
        <div class="grid gap-0.5">
          <div
            class={cn(
              "font-medium text-xs",
              day.isToday ? "text-primary" : "text-foreground",
            )}
          >
            {day.label}
          </div>
          {#if day.sublabel}
            <div class="text-muted-foreground text-xs">{day.sublabel}</div>
          {/if}
        </div>
        <div class="mt-3 grid gap-1.5">
          {#each day.events.slice(0, eventLimit) as event}
            <CalendarEventChip
              href={event.href}
              label={event.label}
              title={event.title}
              tooltip={event.tooltip}
              tooltipDetail={event.tooltipDetail}
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
      </section>
    {/each}
  </div>
</ScrollArea>
