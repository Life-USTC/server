<script lang="ts">
import * as Empty from "$lib/components/ui/empty/index.js";
import SectionCalendarEventCard from "./SectionCalendarEventCard.svelte";
import type {
  SectionCalendarCopy,
  SectionCalendarEvent,
} from "./section-calendar-tab-types";

export let events: SectionCalendarEvent[];
export let fmtDate: (value: string | Date | null | undefined) => string;
export let sectionCopy: SectionCalendarCopy;
</script>

{#if events.length > 0}
  <div class="grid gap-3">
    {#each events as event}
      <SectionCalendarEventCard {event} {fmtDate} {sectionCopy} />
    {/each}
  </div>
{:else}
  <Empty.Root>
    <Empty.Header>
      <Empty.Description>{sectionCopy.calendarEmpty}</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{/if}
