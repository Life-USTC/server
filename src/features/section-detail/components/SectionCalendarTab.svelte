<script lang="ts">
import type { CalendarGridWeek } from "$lib/components/calendar/types";
import CalendarIcon from "$lib/components/icons/calendar.svelte";
import { Alert } from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import SectionCalendarEventCard from "./SectionCalendarEventCard.svelte";
import SectionCalendarMonthView from "./SectionCalendarMonthView.svelte";
import SectionCalendarUnscheduledEvents from "./SectionCalendarUnscheduledEvents.svelte";
import type {
  SectionCalendarCopy,
  SectionCalendarEvent,
} from "./section-calendar-tab-types";

export let calendarGridWeeks: CalendarGridWeek[];
export let calendarMonthLabel: string;
export let calendarMonthOffset: number;
export let dateTimePlaceText: string | null | undefined;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let openCalendarDialog: () => void;
export let sectionCalendarEvents: SectionCalendarEvent[];
export let sectionCopy: SectionCalendarCopy;
export let unscheduledCalendarEvents: SectionCalendarEvent[];
</script>

<section class="grid gap-4">
  <div class="flex flex-wrap items-center justify-end gap-3">
    <Button size="sm" variant="outline" type="button" onclick={openCalendarDialog}>
      <CalendarIcon />
      {sectionCopy.addToCalendar}
    </Button>
  </div>

  {#if dateTimePlaceText}
    <Alert>{dateTimePlaceText}</Alert>
  {/if}

  {#if sectionCalendarEvents.length > 0}
    <SectionCalendarMonthView
      bind:calendarMonthOffset
      {calendarGridWeeks}
      {calendarMonthLabel}
      {formatMessage}
      {sectionCopy}
    />

    <section class="grid gap-3">
      {#each sectionCalendarEvents.filter((event) => event.dateKey) as event}
        <SectionCalendarEventCard {event} {fmtDate} {sectionCopy} />
      {/each}
    </section>

    {#if unscheduledCalendarEvents.length > 0}
      <SectionCalendarUnscheduledEvents
        {sectionCopy}
        events={unscheduledCalendarEvents}
      />
    {/if}
  {:else}
    <Alert>{sectionCopy.calendarEmpty}</Alert>
  {/if}
</section>
