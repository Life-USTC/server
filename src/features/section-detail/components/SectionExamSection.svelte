<script lang="ts">
import CalendarIcon from "@lucide/svelte/icons/calendar";
import Clock3Icon from "@lucide/svelte/icons/clock-3";
import MapPinIcon from "@lucide/svelte/icons/map-pin";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
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

function detailValue(event: SectionCalendarEvent, label: string) {
  return event.details.find((detail) => detail.label === label)?.value ?? "—";
}

function examTime(event: SectionCalendarEvent) {
  return event.meta.split(" · ")[0]?.trim() || "—";
}

function examLocation(event: SectionCalendarEvent) {
  return event.meta.split(" · ").slice(1).join(" · ").trim() || "—";
}
</script>

{#if events.length > 0}
  <ResponsiveCollection>
    {#snippet mobile()}
      <Item.Group
        aria-label={heading}
        class="gap-3"
        data-testid="section-exams-items"
        role="list"
      >
        {#each events as event (event.id)}
          {@const batchLabel = detailValue(event, sectionCopy.examBatch)}
          {@const dateLabel = event.date
            ? fmtDate(event.date)
            : sectionCopy.dateTBD}
          {@const timeLabel = examTime(event)}
          {@const locationLabel = detailValue(event, sectionCopy.location) || examLocation(event)}
          {@const modeLabel = event.title || "—"}
          {@const countLabel = detailValue(event, sectionCopy.examCount)}
          <Item.Root class="items-start p-4" role="listitem" variant="outline">
            <Item.Content class="min-w-0 gap-3">
              <Item.Header class="w-full items-start justify-between gap-3">
                <Item.Title class="line-clamp-none min-w-0 text-base">
                  {modeLabel}
                </Item.Title>
                <span class="text-muted-foreground shrink-0 text-sm">
                  {batchLabel}
                </span>
              </Item.Header>

              <dl class="grid min-w-0 gap-2 text-sm sm:grid-cols-2">
                <div
                  aria-label={`${sectionCopy.examDate}: ${dateLabel}`}
                  class="flex min-w-0 items-start gap-2"
                >
                  <dt class="flex shrink-0 items-start">
                    <CalendarIcon
                      aria-hidden="true"
                      class="text-muted-foreground mt-0.5 size-4"
                    />
                    <span class="sr-only">{sectionCopy.examDate}</span>
                  </dt>
                  <dd class="min-w-0 break-words">{dateLabel}</dd>
                </div>
                <div
                  aria-label={`${sectionCopy.examTime}: ${timeLabel}`}
                  class="flex min-w-0 items-start gap-2"
                >
                  <dt class="flex shrink-0 items-start">
                    <Clock3Icon
                      aria-hidden="true"
                      class="text-muted-foreground mt-0.5 size-4"
                    />
                    <span class="sr-only">{sectionCopy.examTime}</span>
                  </dt>
                  <dd class="min-w-0 break-words">{timeLabel}</dd>
                </div>
                <div
                  aria-label={`${sectionCopy.location}: ${locationLabel}`}
                  class="flex min-w-0 items-start gap-2"
                >
                  <dt class="flex shrink-0 items-start">
                    <MapPinIcon
                      aria-hidden="true"
                      class="text-muted-foreground mt-0.5 size-4"
                    />
                    <span class="sr-only">{sectionCopy.location}</span>
                  </dt>
                  <dd class="min-w-0 break-words">{locationLabel}</dd>
                </div>
              </dl>

              <Item.Footer class="w-full flex-wrap justify-start gap-x-3 gap-y-1">
                <span>
                  <span class="text-muted-foreground">{sectionCopy.examBatch}:</span>
                  {batchLabel}
                </span>
                <span>
                  <span class="text-muted-foreground">{sectionCopy.examCount}:</span>
                  {countLabel}
                </span>
              </Item.Footer>
            </Item.Content>
          </Item.Root>
        {/each}
      </Item.Group>
    {/snippet}
    {#snippet desktop()}
      <div data-testid="section-exams-list">
        <Table.Root>
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
    {/snippet}
  </ResponsiveCollection>
{:else}
  <Empty.Root class="min-h-20 border-0 px-2 py-6">
    <Empty.Header>
      <Empty.Description>{sectionCopy.calendarEmpty}</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{/if}
