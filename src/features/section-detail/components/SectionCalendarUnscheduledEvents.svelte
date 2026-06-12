<script lang="ts">
import type {
  SectionCalendarCopy,
  SectionCalendarEvent,
} from "./section-calendar-tab-types";

export let events: SectionCalendarEvent[];
export let sectionCopy: SectionCalendarCopy;
</script>

<section class="rounded-md border border-base-300 bg-base-100 p-4">
  <h3 class="font-semibold">{sectionCopy.dateTBD}</h3>
  <div class="mt-3 grid gap-2">
    {#each events as event}
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{event.title}</span>
        <span class="text-base-content/60">{event.meta}</span>
      </div>
    {/each}
  </div>
</section>
