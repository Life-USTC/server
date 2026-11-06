<script lang="ts">
import CompactEmpty from "#lib/components/CompactEmpty.svelte";
import CalendarGrid from "#lib/components/calendar/CalendarGrid.svelte";
import { Badge } from "#lib/components/ui/badge/index.js";
import { Button, buttonVariants } from "#lib/components/ui/button/index.js";
import * as Collapsible from "#lib/components/ui/collapsible/index.js";
import { createShanghaiDateTimeFormatter } from "@/lib/time/shanghai-format";
import {
  normalizeYoungCalendarDate,
  type YoungCalendarView,
  youngCalendarAgenda,
  youngCalendarDays,
  youngCalendarHeading,
  youngCalendarNextDate,
  youngCalendarPreviousDate,
  youngCalendarRange,
  youngCalendarWeeks,
} from "../lib/young-calendar";
import { youngDateRange, youngDateTime } from "../lib/young-event-display";
import type {
  YoungCalendarEvent,
  YoungEventTimeBasis,
} from "../server/young-event-service";

export let anchorDate: string;
export let events: YoungCalendarEvent[] = [];
export let locale = "zh-cn";
export let timeBasis: YoungEventTimeBasis = "activity";
export let view: YoungCalendarView = "month";
export let conflictIds = new Set<string>();
export let conflictLabel = "";
export let labels: {
  agenda: string;
  earlierDates: string;
  month: string;
  next: string;
  previous: string;
  today: string;
  week: string;
  day: string;
  moreEvents: string;
  sourceMissing: string;
  calendarEmpty: string;
  dayTimes: string;
  crossDayRanges: string;
  startsAt: string;
  endsAt: string;
};
export let hrefFor: (view: YoungCalendarView, date: string) => string = (
  targetView,
  date,
) => `/catalog/young-events/calendar?view=${targetView}&date=${date}`;
export let eventHref = (event: YoungCalendarEvent) =>
  `/catalog/young-events/${event.youngId}`;

$: range = youngCalendarRange(view, anchorDate);
$: days = youngCalendarDays(
  view,
  range,
  events,
  undefined,
  timeBasis,
  anchorDate,
);
$: weeks = youngCalendarWeeks(days).map((week) => ({
  days: week.days.map((day) => ({
    key: day.key,
    moreHref: hrefFor("day", day.key),
    label: createShanghaiDateTimeFormatter(locale, {
      timeZone: "Asia/Shanghai",
      day: "numeric",
    }).format(day.date),
    isToday: day.isToday,
    isMuted: day.isMuted,
    events: (view === "day" ? day.events : day.startingEvents).map((event) => ({
      href: eventHref(event),
      label: event.name,
      meta: formatClock(event),
      title: [
        event.name,
        formatTime(event),
        event.location,
        conflictIds.has(event.youngId) ? conflictLabel : null,
      ]
        .filter(Boolean)
        .join(" · "),
      badge: conflictIds.has(event.youngId) ? conflictLabel : undefined,
      tone: event.sourceMissing ? ("neutral" as const) : ("primary" as const),
    })),
  })),
}));
$: heading = youngCalendarHeading(view, anchorDate, locale);
$: agenda = youngCalendarAgenda(days, anchorDate);

function formatClock(event: YoungCalendarEvent) {
  const start =
    timeBasis === "registration" ? event.applyStartAt : event.startAt;
  if (!start) return "";
  return createShanghaiDateTimeFormatter(locale, {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(start));
}

function formatTime(event: YoungCalendarEvent) {
  const start =
    timeBasis === "registration" ? event.applyStartAt : event.startAt;
  const end = timeBasis === "registration" ? event.applyEndAt : event.endAt;
  return youngDateRange(start, end, labels) ?? "";
}

function crossesDate(event: YoungCalendarEvent) {
  const start =
    timeBasis === "registration" ? event.applyStartAt : event.startAt;
  const end = timeBasis === "registration" ? event.applyEndAt : event.endAt;
  return Boolean(
    start &&
      end &&
      youngDateTime(start)?.split(" ")[0] !== youngDateTime(end)?.split(" ")[0],
  );
}
</script>

{#snippet eventRows(items: typeof events)}
  <ul class="divide-y">
    {#each items as event (event.youngId)}
      <li>
        <a class="grid min-w-0 gap-1 py-2 text-sm [overflow-wrap:anywhere] hover:bg-muted/60" href={eventHref(event)}>
          <span class="font-medium" data-slot="item-title">{event.name}</span>
          <span class="text-muted-foreground text-xs tabular-nums" data-slot="item-description">{formatTime(event)}</span>
          {#if event.location}<span class="text-muted-foreground text-xs" data-slot="item-description">{event.location}</span>{/if}
          {#if conflictIds.has(event.youngId)}<Badge variant="secondary" class="justify-self-start">{conflictLabel}</Badge>{/if}
          {#if event.sourceMissing}<span class="text-muted-foreground text-xs" data-slot="item-description">{labels.sourceMissing}</span>{/if}
        </a>
      </li>
    {/each}
  </ul>
{/snippet}

{#snippet agendaRows(agendaDays: typeof days, prefix = "young-agenda")}
  {#each agendaDays as day}
    {@const visible = view === "day" ? day.events : day.startingEvents}
    {@const limit = view === "week" ? 6 : view === "month" ? 3 : visible.length}
    <section aria-labelledby={`${prefix}-${day.key}`} class="grid min-w-0 gap-2">
      <h3 id={`${prefix}-${day.key}`} class="text-sm font-medium">
        <a class="hover:underline" href={hrefFor("day", day.key)}>
          {createShanghaiDateTimeFormatter(locale, {timeZone: "Asia/Shanghai", weekday: "long", month: "short", day: "numeric"}).format(day.date)}
        </a>
        {#if day.isToday}<Badge variant="secondary">{labels.today}</Badge>{/if}
      </h3>
      {#if view === "day"}
        {#each [false, true] as crossDay}
          {@const group = visible.filter((event) => crossesDate(event) === crossDay)}
          {#if group.length}
            <div class="grid min-w-0 gap-1">
              <h4 class="text-sm font-medium">{crossDay ? labels.crossDayRanges : labels.dayTimes}</h4>
              {@render eventRows(group)}
            </div>
          {/if}
        {/each}
      {:else}
        {@render eventRows(visible.slice(0, limit))}
        {#if visible.length > limit}
          <a class="text-muted-foreground text-xs underline" href={hrefFor("day", day.key)}>{labels.moreEvents.replace("{count}", String(visible.length - limit))}</a>
        {/if}
      {/if}
    </section>
  {/each}
{/snippet}

<section class="grid gap-4" data-testid="young-calendar">
  <div class="flex min-w-0 items-center justify-between gap-1 sm:gap-3">
    <div class="flex shrink-0 items-center gap-1 sm:gap-2">
      <Button class="max-md:min-h-8 max-md:min-w-0 max-md:px-2" aria-label={labels.previous} variant="outline" href={hrefFor(view, youngCalendarPreviousDate(view, anchorDate))}>‹</Button>
      <Button class="max-md:min-h-8 max-md:min-w-0 max-md:px-2" variant="outline" href={hrefFor(view, normalizeYoungCalendarDate(null))}>{labels.today}</Button>
      <Button class="max-md:min-h-8 max-md:min-w-0 max-md:px-2" aria-label={labels.next} variant="outline" href={hrefFor(view, youngCalendarNextDate(view, anchorDate))}>›</Button>
    </div>
    <h2 class="min-w-0 flex-1 truncate text-center font-medium text-sm sm:text-base">{heading}</h2>
    <nav aria-label={labels.agenda} class="flex shrink-0 items-center gap-1">
      {#each ["day", "week", "month"] as targetView}
        <Button class="max-md:min-h-8 max-md:min-w-0 max-md:px-2" variant={view === targetView ? "secondary" : "ghost"} aria-current={view === targetView ? "page" : undefined} href={hrefFor(targetView as YoungCalendarView, anchorDate)}>{labels[targetView as YoungCalendarView]}</Button>
      {/each}
    </nav>
  </div>

  {#if events.length === 0}
    <CompactEmpty
      class="justify-self-stretch"
      description={labels.calendarEmpty}
    />
  {/if}

  <div class="md:hidden" data-testid="young-calendar-agenda">
    <div aria-label={labels.agenda} class="grid gap-5" role="region">
      {@render agendaRows(agenda.current)}
      {#if agenda.earlier.length}
        <Collapsible.Root class="grid gap-3">
          <Collapsible.Trigger class={buttonVariants({ variant: "outline", class: "justify-self-start" })}>{labels.earlierDates}</Collapsible.Trigger>
          <Collapsible.Content class="grid gap-5">{@render agendaRows(agenda.earlier)}</Collapsible.Content>
        </Collapsible.Root>
      {/if}
    </div>
  </div>

  <div class="hidden min-w-0 md:block" data-testid="young-calendar-grid">
    {#if view === "day"}
      <div class="grid min-w-0 gap-2 rounded-xl border p-4">
        {@render agendaRows(days, "young-grid")}
      </div>
    {:else}
      <CalendarGrid
        density="lines"
        emptyLabel=""
        eventLimit={view === "week" ? 6 : 3}
        moreLabel={(count) => labels.moreEvents.replace("{count}", String(count))}
        minWidth="760px"
        {weeks}
        variant={view === "week" ? "week" : "month"}
        weekdays={weeks[0]?.days.map((day) =>
          createShanghaiDateTimeFormatter(locale, {
            timeZone: "Asia/Shanghai",
            weekday: "short",
          }).format(new Date(`${day.key}T12:00:00+08:00`)),
        ) ?? []}
      />
    {/if}
  </div>
</section>
