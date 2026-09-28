<script lang="ts">
import CalendarGrid from "$lib/components/calendar/CalendarGrid.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import { Button, buttonVariants } from "$lib/components/ui/button";
import * as Collapsible from "$lib/components/ui/collapsible";
import {
  type YoungCalendarView,
  youngCalendarAgenda,
  youngCalendarDays,
  youngCalendarHeading,
  youngCalendarNextDate,
  youngCalendarPreviousDate,
  youngCalendarRange,
  youngCalendarWeeks,
  youngEventStartsOnDay,
} from "../lib/young-calendar";
import type {
  YoungEventSummary,
  YoungEventTimeBasis,
} from "../server/young-event-service";

export let anchorDate: string;
export let events: YoungEventSummary[] = [];
export let locale = "zh-cn";
export let timeBasis: YoungEventTimeBasis = "activity";
export let view: YoungCalendarView = "month";
export let unknownDateCount = 0;
export let conflictIds = new Set<string>();
export let conflictLabel = "";
export let unknownDatesHref = "/catalog/young-events?dateUnknown=true";
export let labels: {
  agenda: string;
  earlierDates: string;
  month: string;
  next: string;
  previous: string;
  today: string;
  unknownDates: string;
  week: string;
  day: string;
  moreEvents: string;
  sourceMissing: string;
};
export let hrefFor: (view: YoungCalendarView, date: string) => string = (
  targetView,
  date,
) => `/catalog/young-events/calendar?view=${targetView}&date=${date}`;
export let eventHref = (event: YoungEventSummary) =>
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
$: weeks = youngCalendarWeeks(
  view,
  range,
  events,
  undefined,
  timeBasis,
  anchorDate,
).map((week) => ({
  days: week.days.map((day) => ({
    key: day.key,
    moreHref: hrefFor("day", day.key),
    label: new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Shanghai",
      day: "numeric",
    }).format(day.date),
    isToday: day.isToday,
    isMuted: day.isMuted,
    events: (view === "day"
      ? day.events
      : day.events.filter((event) =>
          youngEventStartsOnDay(event, day.key, timeBasis),
        )
    ).map((event) => ({
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

function formatClock(event: YoungEventSummary) {
  const start =
    timeBasis === "registration" ? event.applyStartAt : event.startAt;
  if (!start) return "";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(start));
}

function formatTime(event: YoungEventSummary) {
  const start =
    timeBasis === "registration" ? event.applyStartAt : event.startAt;
  const end = timeBasis === "registration" ? event.applyEndAt : event.endAt;
  if (!start && !end) return "";
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${start ? formatter.format(new Date(start)) : "?"} – ${end ? formatter.format(new Date(end)) : "?"}`;
}

function eventMeta(event: YoungEventSummary) {
  return [
    formatTime(event),
    event.location,
    conflictIds.has(event.youngId) ? conflictLabel : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
</script>

{#snippet agendaRows(agendaDays: typeof days)}
      {#each agendaDays as day}
        {@const visible = view === "day" ? day.events : day.events.filter((event) => youngEventStartsOnDay(event, day.key, timeBasis))}
        {@const limit = view === "week" ? 6 : view === "month" ? 3 : visible.length}
        <section aria-labelledby={`young-agenda-${day.key}`} class="grid gap-2">
          <h3 id={`young-agenda-${day.key}`} class="text-sm font-medium">
            <a class="hover:underline" href={hrefFor("day", day.key)}>
              {new Intl.DateTimeFormat(locale, {
                timeZone: "Asia/Shanghai",
                weekday: "long",
                month: "short",
                day: "numeric",
              }).format(day.date)}
            </a>
            {#if day.isToday}<Badge variant="secondary">{labels.today}</Badge>{/if}
          </h3>
          {#if visible.length > 0}
            <ul class="divide-y">
              {#each visible.slice(0, limit) as event (event.youngId)}
                <li>
                  <a class="grid grid-cols-[3.25rem_minmax(0,1fr)] items-baseline gap-3 py-2 text-sm hover:bg-muted/60" href={eventHref(event)}>
                    <time class="tabular-nums text-muted-foreground">{formatClock(event) || "–"}</time>
                    <span class="min-w-0">
                      <span class="block truncate font-medium">{event.name}</span>
                      {#if event.location || event.sourceMissing}
                        <span class="block truncate text-muted-foreground text-xs">{[event.location, event.sourceMissing ? labels.sourceMissing : null].filter(Boolean).join(" · ")}</span>
                      {/if}
                    </span>
                  </a>
                </li>
              {/each}
            </ul>
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
      <Button class="max-md:min-h-8 max-md:min-w-0 max-md:px-2" variant="outline" href={hrefFor(view, new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date()))}>{labels.today}</Button>
      <Button class="max-md:min-h-8 max-md:min-w-0 max-md:px-2" aria-label={labels.next} variant="outline" href={hrefFor(view, youngCalendarNextDate(view, anchorDate))}>›</Button>
    </div>
    <h2 class="min-w-0 flex-1 truncate text-center font-medium text-sm sm:text-base">{heading}</h2>
    <nav aria-label={labels.agenda} class="flex shrink-0 items-center gap-1">
      {#each ["day", "week", "month"] as targetView}
        <Button class="max-md:min-h-8 max-md:min-w-0 max-md:px-2" variant={view === targetView ? "secondary" : "ghost"} aria-current={view === targetView ? "page" : undefined} href={hrefFor(targetView as YoungCalendarView, anchorDate)}>{labels[targetView as YoungCalendarView]}</Button>
      {/each}
    </nav>
  </div>

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

  <div class="hidden md:block" data-testid="young-calendar-grid">
    {#if view === "day"}
      {@const day = days[0]}
      {#if day}
        <div class="grid gap-2 rounded-xl border p-4">
          <div class="font-medium text-sm">
            {new Intl.DateTimeFormat(locale, {
              timeZone: "Asia/Shanghai",
              dateStyle: "full",
            }).format(day.date)}
          </div>
          {#each day.events as event (event.youngId)}
            <a class="grid grid-cols-[3.25rem_minmax(0,1fr)] items-baseline gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted" href={eventHref(event)}>
              <time class="tabular-nums text-muted-foreground">{formatClock(event) || "–"}</time>
              <span class="min-w-0">
                <span class="block font-medium">{event.name}</span>
                <span class="block truncate text-muted-foreground text-xs">{[eventMeta(event), event.sourceMissing ? labels.sourceMissing : null].filter(Boolean).join(" · ")}</span>
              </span>
            </a>
          {/each}
        </div>
      {/if}
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
          new Intl.DateTimeFormat(locale, {
            timeZone: "Asia/Shanghai",
            weekday: "short",
          }).format(new Date(`${day.key}T12:00:00+08:00`)),
        ) ?? []}
      />
    {/if}
  </div>

  {#if unknownDateCount > 0}
    <p class="text-right text-xs text-muted-foreground" data-testid="young-calendar-unknown-dates">
      <a class="underline underline-offset-4" href={unknownDatesHref}>{unknownDateCount} {labels.unknownDates}</a>
    </p>
  {/if}
</section>
