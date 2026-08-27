<script lang="ts">
import {
  calendarEventDetail,
  calendarEventLocation,
  calendarEventTime,
} from "@/features/section-detail/lib/section-calendar-display";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type { SectionCalendarEvent } from "./section-calendar-tab-types";

type SectionExamCopy = {
  calendarEmpty: string;
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
export let sectionCopy: SectionExamCopy;
</script>

{#if events.length > 0}
  <div class="min-w-0 max-w-full">
    <Table.Root
      class="min-w-[52rem] md:min-w-0"
      containerLabel={heading}
      data-testid="section-exams-list"
    >
      <Table.Caption class="sr-only">{heading}</Table.Caption>
      <Table.Header>
        <Table.Row>
          <Table.Head scope="col">{sectionCopy.examBatch}</Table.Head>
          <Table.Head scope="col">{sectionCopy.examDate}</Table.Head>
          <Table.Head scope="col">{sectionCopy.examTime}</Table.Head>
          <Table.Head scope="col">{sectionCopy.location}</Table.Head>
          <Table.Head scope="col">{sectionCopy.examMode}</Table.Head>
          <Table.Head scope="col">{sectionCopy.examCount}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each events as event (event.id)}
          <Table.Row id={event.id}>
            <Table.Cell class="whitespace-nowrap">
              {calendarEventDetail(event, sectionCopy.examBatch, "—")}
            </Table.Cell>
            <Table.Cell class="whitespace-nowrap">
              {#if event.date}{fmtDate(event.date)}{:else}{sectionCopy.dateTBD}{/if}
            </Table.Cell>
            <Table.Cell class="whitespace-nowrap">
              {calendarEventTime(event, "—")}
            </Table.Cell>
            <Table.Cell class="whitespace-nowrap">
              {calendarEventDetail(
                event,
                sectionCopy.location,
                calendarEventLocation(event, "—"),
              )}
            </Table.Cell>
            <Table.Cell class="whitespace-nowrap">{event.title || "—"}</Table.Cell>
            <Table.Cell class="whitespace-nowrap">
              {calendarEventDetail(event, sectionCopy.examCount, "—")}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
{:else}
  <Empty.Root class="min-h-20 border-0 px-2 py-6">
    <Empty.Header>
      <Empty.Description>{sectionCopy.calendarEmpty}</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{/if}
