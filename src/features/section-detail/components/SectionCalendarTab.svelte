<script lang="ts">
import CalendarIcon from "@lucide/svelte/icons/calendar";
import type { CalendarGridWeek } from "$lib/components/calendar/types";
import * as Alert from "$lib/components/ui/alert/index.js";
import { Button } from "$lib/components/ui/button/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
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
export let formatMessage: (
  template: string,
  values: Record<string, string>,
) => string;
export let openCalendarDialog: () => void;
export let sectionCalendarEvents: SectionCalendarEvent[];
export let sectionCopy: SectionCalendarCopy;
export let todayCalendarMonthOffset: number;
export let unscheduledCalendarEvents: SectionCalendarEvent[];
</script>

<section class="grid gap-4">
  <div class="flex flex-wrap items-center justify-end gap-3">
    <Button size="sm" variant="outline" type="button" onclick={openCalendarDialog}>
      <CalendarIcon data-icon="inline-start" />
      {sectionCopy.addToCalendar}
    </Button>
  </div>

  {#if dateTimePlaceText}
    <Alert.Root>
      <Alert.Description>{dateTimePlaceText}</Alert.Description>
    </Alert.Root>
  {/if}

  {#if sectionCalendarEvents.length > 0}
    <SectionCalendarMonthView
      bind:calendarMonthOffset
      {calendarGridWeeks}
      {calendarMonthLabel}
      {formatMessage}
      {sectionCopy}
      {todayCalendarMonthOffset}
    />

    {#if unscheduledCalendarEvents.length > 0}
      <SectionCalendarUnscheduledEvents
        {sectionCopy}
        events={unscheduledCalendarEvents}
      />
    {/if}
  {:else}
    <Empty.Root>
      <Empty.Header>
        <Empty.Description>{sectionCopy.calendarEmpty}</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</section>
