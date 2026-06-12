<script lang="ts">
import { Badge } from "$lib/components/ui/badge/index.js";
import type {
  SectionCalendarCopy,
  SectionCalendarEvent,
} from "./section-calendar-tab-types";

export let event: SectionCalendarEvent;
export let fmtDate: (value: string | Date | null | undefined) => string;
export let sectionCopy: SectionCalendarCopy;
</script>

<article class="rounded-lg border border-base-300 bg-base-100 p-4" id={event.id}>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h3 class="font-semibold">{event.title}</h3>
      <p class="mt-1 text-base-content/60 text-sm">
        {fmtDate(event.date)} · {event.meta}
      </p>
    </div>
    <Badge variant={event.kind === "exam" ? "secondary" : "outline"}>
      {event.kind === "exam" ? sectionCopy.examEvent : sectionCopy.classEvent}
    </Badge>
  </div>
  <div class="mt-3 flex flex-wrap gap-2">
    {#each event.badges as badge}
      <Badge variant="ghost">{badge}</Badge>
    {/each}
  </div>
  {#if event.details.length > 0}
    <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
      {#each event.details as detail}
        <div class="rounded-md border border-base-300 bg-base-200/40 p-2">
          <dt class="text-base-content/60 text-xs">{detail.label}</dt>
          <dd class="mt-1 font-medium">{detail.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}
</article>
