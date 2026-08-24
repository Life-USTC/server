<script lang="ts">
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
export let sectionCopy: SectionExamCopy;

function detailValue(event: SectionCalendarEvent, label: string) {
  return event.details.find((detail) => detail.label === label)?.value ?? "—";
}

function examTime(event: SectionCalendarEvent) {
  return event.meta.split(" · ")[0]?.trim() || "—";
}
</script>

{#if events.length > 0}
  <div class="min-w-0 overflow-x-auto">
    <Table.Root data-testid="section-exams-list">
      <Table.Header>
        <Table.Row>
          <Table.Head>{sectionCopy.examBatch}</Table.Head>
          <Table.Head>{sectionCopy.examDate}</Table.Head>
          <Table.Head>{sectionCopy.examTime}</Table.Head>
          <Table.Head>{sectionCopy.location}</Table.Head>
          <Table.Head>{sectionCopy.examMode}</Table.Head>
          <Table.Head>{sectionCopy.examCount}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each events as event (event.id)}
          <Table.Row id={event.id}>
            <Table.Cell>
              {detailValue(event, sectionCopy.examBatch)}
            </Table.Cell>
            <Table.Cell>
              {#if event.date}{fmtDate(event.date)}{:else}{sectionCopy.dateTBD}{/if}
            </Table.Cell>
            <Table.Cell>{examTime(event)}</Table.Cell>
            <Table.Cell>
              {detailValue(event, sectionCopy.location)}
            </Table.Cell>
            <Table.Cell>{event.title}</Table.Cell>
            <Table.Cell>
              {detailValue(event, sectionCopy.examCount)}
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
