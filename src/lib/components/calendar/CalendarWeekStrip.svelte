<script lang="ts">
import CalendarEventChip from "./CalendarEventChip.svelte";

type CalendarWeekEvent = {
  done?: boolean;
  href?: string;
  label: string;
  title?: string;
  tooltip?: string;
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

<div class="overflow-x-auto">
  <div class="grid grid-cols-7 gap-2" style={`min-width: ${minWidth};`}>
    {#each days as day}
      <section
        class={`min-h-52 rounded-xl border bg-base-100 p-2 ${day.isToday ? "border-primary" : "border-base-300"}`}
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
      </section>
    {/each}
  </div>
</div>
