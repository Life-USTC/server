<script lang="ts">
import TeacherIcon from "@lucide/svelte/icons/user-round";
import type { DemoIdentity } from "@/features/demo/lib/demo-types";
export let pageDemo: DemoIdentity | null | undefined = null;
export let locale = "";

import CollectionEmpty from "#lib/components/CollectionEmpty.svelte";
import * as Table from "#lib/components/ui/table/index.js";
import RoomMapPreview from "@/features/rooms/components/RoomMapPreview.svelte";
import type { RoomMapCopy } from "@/features/rooms/lib/room-map-types";
import { formatMessage } from "@/features/section-detail/lib/display";
import {
  calendarEventLocation,
  sectionLessonRows,
} from "@/features/section-detail/lib/section-calendar-display";
import type { SectionCalendarEvent } from "./section-calendar-tab-types";

export let sectionCalendarEvents: SectionCalendarEvent[];
export let roomMapCopy: RoomMapCopy;
export let sectionCopy: {
  calendarEmpty: string;
  scheduleDateTime: string;
  dateTBD: string;
  examEvent: string;
  lecture: string;
  lectureNumber: string;
  location: string;
  time: string;
  teacher: string;
  week: string;
};
$: rows = sectionLessonRows(sectionCalendarEvents, sectionCopy.week);
</script>

{#if rows.length}
  <Table.Root class="max-sm:[&_td]:px-1.5 max-sm:[&_th]:px-1.5" containerLabel={sectionCopy.lecture} data-testid="section-calendar-table">
    <Table.Caption class="sr-only">{sectionCopy.lecture}</Table.Caption>
    <Table.Header>
      <Table.Row>
        <Table.Head scope="col">{sectionCopy.week}</Table.Head>
        <Table.Head scope="col">{sectionCopy.lecture}</Table.Head>
        <Table.Head scope="col">{sectionCopy.scheduleDateTime}</Table.Head>
        <Table.Head scope="col">{sectionCopy.location}</Table.Head>
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each rows as row, index (row.event.id)}
        <Table.Row>
          {#if row.weekSpan}
            <Table.Cell rowspan={row.weekSpan} class="tabular-nums">{row.week || "—"}</Table.Cell>
          {/if}
          <Table.Cell>
            <div class="flex flex-col items-start sm:flex-row sm:items-baseline sm:gap-x-2">
              <span class="grid shrink-0 whitespace-nowrap tabular-nums">
                <span class="invisible col-start-1 row-start-1 hidden sm:block" aria-hidden="true">{formatMessage(sectionCopy.lectureNumber, { num: String(rows.length) })}</span>
                <span class="col-start-1 row-start-1">{formatMessage(sectionCopy.lectureNumber, { num: String(index + 1) })}</span>
              </span>
              <div class="flex min-w-0 flex-wrap items-baseline gap-x-2">
                {#each row.event.teachers ?? [] as teacher (teacher.id)}
                  <a class="min-h-6 min-w-6 leading-6 text-muted-foreground" class:whitespace-nowrap={teacher.name.length <= 4} href={`/catalog/teachers/${teacher.id}`}><TeacherIcon aria-hidden="true" class="me-1 inline size-4 shrink-0 align-[-0.125em]" />{teacher.name}</a>
                {/each}
              </div>
            </div>
          </Table.Cell>
          {#if row.timeSpan}
            <Table.Cell rowspan={row.timeSpan} class="tabular-nums">
              <div class="flex flex-wrap gap-x-2">
                <span class="whitespace-nowrap">{row.event.dateKey || sectionCopy.dateTBD}</span><span class="whitespace-nowrap">{row.time}</span>
              </div>
            </Table.Cell>
          {/if}
          <Table.Cell class="text-foreground">
            {#if row.event.roomCodes?.length}
              {#each row.event.roomCodes as room (room)}
                <RoomMapPreview tableCell {pageDemo} {locale} code={room} label={row.event.roomCodes.length === 1 ? calendarEventLocation(row.event, room) : room} copy={roomMapCopy} />
              {/each}
            {:else}
              {calendarEventLocation(row.event, "—")}
            {/if}
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{:else}
  <CollectionEmpty variant="quiet" description={sectionCopy.calendarEmpty} />
{/if}
