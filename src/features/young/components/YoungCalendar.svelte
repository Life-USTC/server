<script lang="ts">
import CalendarGrid from "$lib/components/calendar/CalendarGrid.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import {
  type YoungCalendarView,
  youngCalendarDays,
  youngCalendarNextDate,
  youngCalendarPreviousDate,
  youngCalendarRange,
  youngCalendarWeeks,
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
  empty: string;
  month: string;
  next: string;
  previous: string;
  today: string;
  unknownDates: string;
  week: string;
  day: string;
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
    sublabel: new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Shanghai",
      weekday: "short",
    }).format(day.date),
    isToday: day.isToday,
    isMuted: day.isMuted,
    events: day.events.map((event) => ({
      href: eventHref(event),
      label: event.name,
      meta: formatTime(event),
      badge: conflictIds.has(event.youngId) ? conflictLabel : undefined,
      detail: event.sourceMissing
        ? `${event.location ?? ""}${event.location ? " · " : ""}${labels.sourceMissing}`
        : (event.location ?? ""),
      tone: event.sourceMissing ? ("neutral" as const) : ("primary" as const),
    })),
  })),
}));
$: dayLabel = new Intl.DateTimeFormat(locale, {
  timeZone: "Asia/Shanghai",
  dateStyle: "full",
});
$: heading = `${dayLabel.format(new Date(`${anchorDate}T00:00:00+08:00`))}`;

function formatTime(event: YoungEventSummary) {
  const start =
    timeBasis === "registration" ? event.applyStartAt : event.startAt;
  const end = timeBasis === "registration" ? event.applyEndAt : event.endAt;
  if (!start && !end) return "";
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
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

<section class="grid gap-4" data-testid="young-calendar">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <a
        aria-label={labels.previous}
        class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        href={hrefFor(view, youngCalendarPreviousDate(view, anchorDate))}
      >
        ‹
      </a>
      <a
        class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        href={hrefFor(view, new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date()))}
      >
        {labels.today}
      </a>
      <a
        aria-label={labels.next}
        class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        href={hrefFor(view, youngCalendarNextDate(view, anchorDate))}
      >
        ›
      </a>
    </div>
    <h2 class="font-medium text-sm sm:text-base">{heading}</h2>
    <nav aria-label={labels.agenda} class="flex items-center gap-1 rounded-md border p-1">
      <a class="rounded px-2 py-1 text-xs hover:bg-muted" href={hrefFor("day", anchorDate)}>{labels.day}</a>
      <a class="rounded px-2 py-1 text-xs hover:bg-muted" href={hrefFor("week", anchorDate)}>{labels.week}</a>
      <a class="rounded px-2 py-1 text-xs hover:bg-muted" href={hrefFor("month", anchorDate)}>{labels.month}</a>
    </nav>
  </div>

  <div class="md:hidden" data-testid="young-calendar-agenda">
    <div aria-label={labels.agenda} class="grid gap-5" role="region">
      {#each days as day}
        <section aria-labelledby={`young-agenda-${day.key}`} class="grid gap-2">
          <h3 id={`young-agenda-${day.key}`} class="text-sm font-medium">
            {new Intl.DateTimeFormat(locale, {
              timeZone: "Asia/Shanghai",
              weekday: "long",
              month: "short",
              day: "numeric",
            }).format(day.date)}
            {#if day.isToday}<Badge variant="secondary">{labels.today}</Badge>{/if}
          </h3>
          {#if day.events.length > 0}
            <Item.Group class="grid gap-2">
              {#each day.events as event (event.youngId)}
                <Item.Root size="sm" variant={event.sourceMissing ? "muted" : "outline"}>
                  {#snippet child({ props })}
                    <a href={eventHref(event)} {...props}>
                      <Item.Content>
                        <Item.Title>{event.name}</Item.Title>
                        <Item.Description>{eventMeta(event)}</Item.Description>
                        {#if event.sourceMissing}
                          <Item.Description>{labels.sourceMissing}</Item.Description>
                        {/if}
                      </Item.Content>
                    </a>
                  {/snippet}
                </Item.Root>
              {/each}
            </Item.Group>
          {:else}
            <p class="text-sm text-muted-foreground">{labels.empty}</p>
          {/if}
        </section>
      {/each}
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
            <a class="rounded-lg border p-3 hover:bg-muted" href={eventHref(event)}>
              <div class="font-medium">{event.name}</div>
              <div class="text-muted-foreground text-sm">{eventMeta(event)}</div>
              {#if event.sourceMissing}<div class="text-muted-foreground text-xs">{labels.sourceMissing}</div>{/if}
            </a>
          {:else}
            <p class="text-sm text-muted-foreground">{labels.empty}</p>
          {/each}
        </div>
      {:else}
        <p class="text-sm text-muted-foreground">{labels.empty}</p>
      {/if}
    {:else}
      <CalendarGrid
        emptyLabel={labels.empty}
        eventLimit={view === "week" ? 8 : 5}
        moreLabel={(count) => `+${count}`}
        minWidth="760px"
        {weeks}
        variant={view === "week" ? "week" : "month"}
        weekdays={weeks[0]?.days.map((day) => day.sublabel ?? "") ?? []}
      />
    {/if}
  </div>

  {#if unknownDateCount > 0}
    <section class="grid gap-2" data-testid="young-calendar-unknown-dates">
      <h3 class="font-medium text-sm">{labels.unknownDates}</h3>
      <p class="text-muted-foreground text-sm">
        <a class="underline underline-offset-4" href={unknownDatesHref}>{unknownDateCount} {labels.unknownDates}</a>
      </p>
    </section>
  {/if}
</section>
