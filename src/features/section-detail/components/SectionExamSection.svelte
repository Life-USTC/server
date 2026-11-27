<script lang="ts">
import type { DemoIdentity } from "@/features/demo/lib/demo-types";
export let pageDemo: DemoIdentity | null | undefined = null;
export let locale = "";

import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import Table from "#lib/components/ui/table/table.svelte";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import type { RoomMapCopy } from "@/features/rooms/lib/room-map-types";
import {
  calendarEventDetail,
  calendarEventLocation,
  calendarEventTime,
} from "@/features/section-detail/lib/section-calendar-display";
import type { SectionCalendarEvent } from "./section-calendar-tab-types";

type SectionExamCopy = {
  examEmpty: string;
  dateTBD: string;
  examBatch: string;
  examCount: string;
  examDate: string;
  examMode: string;
  examTime: string;
  location: string;
};

export let events: SectionCalendarEvent[];
export let fmtDate: (value: string | Date | null | undefined) => string;
export let heading: string;
export let roomMapCopy: RoomMapCopy;
export let sectionCopy: SectionExamCopy;
</script>

{#if events.length > 0}
  <div class="min-w-0 max-w-full">
    <Table
      class="min-w-[52rem] md:min-w-0"
      containerLabel={heading}
      data-testid="section-exams-list"
    >
      <caption class="sr-only">{heading}</caption>
      <thead>
        <tr>
          <th scope="col">{sectionCopy.examBatch}</th>
          <th scope="col">{sectionCopy.examDate}</th>
          <th scope="col">{sectionCopy.examTime}</th>
          <th scope="col">{sectionCopy.location}</th>
          <th scope="col">{sectionCopy.examMode}</th>
          <th scope="col">{sectionCopy.examCount}</th>
        </tr>
      </thead>
      <tbody>
        {#each events as event (event.id)}
          <tr id={event.id}>
            <td class="whitespace-nowrap">
              {calendarEventDetail(event, sectionCopy.examBatch, "—")}
            </td>
            <td class="whitespace-nowrap font-medium">
              {#if event.date}{fmtDate(event.date)}{:else}{sectionCopy.dateTBD}{/if}
            </td>
            <td class="whitespace-nowrap">
              {calendarEventTime(event, "—")}
            </td>
            <td class="whitespace-nowrap">
              {#if event.roomCodes?.length}
                <div class="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                  {#each event.roomCodes as room (room)}
                    <RoomMapPreview tableCell {pageDemo} {locale} code={room} copy={roomMapCopy} />
                  {/each}
                </div>
              {:else}
                {calendarEventDetail(
                  event,
                  sectionCopy.location,
                  calendarEventLocation(event, "—"),
                )}
              {/if}
            </td>
            <td class="whitespace-nowrap">{event.title || "—"}</td>
            <td class="whitespace-nowrap text-left tabular-nums">
              {calendarEventDetail(event, sectionCopy.examCount, "—")}
            </td>
          </tr>
        {/each}
      </tbody>
    </Table>
  </div>
{:else}
  <CollectionEmpty variant="quiet" description={sectionCopy.examEmpty} />
{/if}
