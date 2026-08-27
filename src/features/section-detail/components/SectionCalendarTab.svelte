<script lang="ts">
import CalendarIcon from "@lucide/svelte/icons/calendar";
import Clock3Icon from "@lucide/svelte/icons/clock-3";
import MapPinIcon from "@lucide/svelte/icons/map-pin";
import { formatMessage } from "@/features/section-detail/lib/display";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import ResponsiveCollection from "$lib/components/ResponsiveCollection.svelte";
import { Badge } from "$lib/components/ui/badge/index.js";
import * as Empty from "$lib/components/ui/empty/index.js";
import * as Item from "$lib/components/ui/item/index.js";
import * as Table from "$lib/components/ui/table/index.js";
import type { SectionCalendarEvent } from "./section-calendar-tab-types";

export let sectionCalendarEvents: SectionCalendarEvent[];
export let sectionCopy: {
  calendarEmpty: string;
  date: string;
  dateTBD: string;
  examEvent: string;
  lecture: string;
  lectureNumber: string;
  location: string;
  time: string;
  week: string;
};
export let unscheduledCalendarEvents: SectionCalendarEvent[];

function detailValue(event: SectionCalendarEvent, label: string) {
  return event.details.find((detail) => detail.label === label)?.value ?? "";
}

function eventTime(event: SectionCalendarEvent) {
  const [time] = event.meta.split(" · ");
  return time?.trim() || "";
}

function eventLocation(event: SectionCalendarEvent) {
  return event.meta.split(" · ").slice(1).join(" · ").trim();
}

/** Campus date → YYYY-MM-DD. */
function formatYyyyMmDd(value: string | Date | null | undefined) {
  if (value == null) return "";
  try {
    return formatShanghaiDate(value);
  } catch {
    return "";
  }
}

function lectureLabel(event: SectionCalendarEvent) {
  if (event.kind === "exam") return sectionCopy.examEvent;
  return formatMessage(sectionCopy.lectureNumber, {
    num: String(classLectureNumberById.get(event.id) ?? ""),
  });
}

$: datedEvents = sectionCalendarEvents
  .filter((event) => event.dateKey)
  .slice()
  .sort((left, right) => {
    const leftKey = left.dateKey ?? "";
    const rightKey = right.dateKey ?? "";
    if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
    return left.meta.localeCompare(right.meta);
  });

$: classLectureNumberById = new Map(
  datedEvents
    .filter((event) => event.kind === "class")
    .map((event, index) => [event.id, index + 1] as const),
);
$: mobileEvents = [...datedEvents, ...unscheduledCalendarEvents];
</script>

{#if datedEvents.length > 0 || unscheduledCalendarEvents.length > 0}
  <ResponsiveCollection>
    {#snippet mobile()}
      <Item.Group
        aria-label={sectionCopy.lecture}
        class="gap-3"
        data-testid="section-calendar-items"
        role="list"
      >
        {#each mobileEvents as event (event.id)}
          {@const dateLabel = event.dateKey
            ? formatYyyyMmDd(event.dateKey)
            : sectionCopy.dateTBD}
          {@const weekLabel = detailValue(event, sectionCopy.week) || "—"}
          {@const timeLabel = eventTime(event) || "—"}
          {@const locationLabel = eventLocation(event) || "—"}
          <Item.Root class="items-start p-4" role="listitem" variant="outline">
            <Item.Content class="min-w-0 gap-3">
              <Item.Header class="w-full items-start justify-between gap-3">
                <Item.Title class="line-clamp-none min-w-0 text-base">
                  {lectureLabel(event)}
                </Item.Title>
                {#if event.kind === "exam"}
                  <Badge class="shrink-0" variant="secondary">
                    {sectionCopy.examEvent}
                  </Badge>
                {/if}
              </Item.Header>

              <dl class="grid min-w-0 gap-2 text-sm sm:grid-cols-2">
                <div
                  aria-label={`${sectionCopy.date}: ${dateLabel}`}
                  class="flex min-w-0 items-start gap-2"
                  role="group"
                >
                  <CalendarIcon
                    aria-hidden="true"
                    class="text-muted-foreground mt-0.5 size-4 shrink-0"
                  />
                  <dt class="sr-only">{sectionCopy.date}</dt>
                  <dd class="min-w-0 break-words">{dateLabel}</dd>
                </div>
                <div
                  aria-label={`${sectionCopy.week}: ${weekLabel}`}
                  class="flex min-w-0 items-start gap-2"
                  role="group"
                >
                  <span
                    aria-hidden="true"
                    class="text-muted-foreground mt-0.5 size-4 shrink-0 text-center text-xs font-medium leading-4"
                  >
                    W
                  </span>
                  <dt class="sr-only">{sectionCopy.week}</dt>
                  <dd class="min-w-0 break-words">{weekLabel}</dd>
                </div>
                <div
                  aria-label={`${sectionCopy.time}: ${timeLabel}`}
                  class="flex min-w-0 items-start gap-2"
                  role="group"
                >
                  <Clock3Icon
                    aria-hidden="true"
                    class="text-muted-foreground mt-0.5 size-4 shrink-0"
                  />
                  <dt class="sr-only">{sectionCopy.time}</dt>
                  <dd class="min-w-0 break-words">{timeLabel}</dd>
                </div>
                <div
                  aria-label={`${sectionCopy.location}: ${locationLabel}`}
                  class="flex min-w-0 items-start gap-2"
                  role="group"
                >
                  <MapPinIcon
                    aria-hidden="true"
                    class="text-muted-foreground mt-0.5 size-4 shrink-0"
                  />
                  <dt class="sr-only">{sectionCopy.location}</dt>
                  <dd class="min-w-0 break-words">{locationLabel}</dd>
                </div>
              </dl>
            </Item.Content>
          </Item.Root>
        {/each}
      </Item.Group>
    {/snippet}
    {#snippet desktop()}
      <div class="min-w-0" data-testid="section-calendar-table">
        <Table.Root>
          <Table.Caption class="sr-only">{sectionCopy.lecture}</Table.Caption>
          <Table.Header>
            <Table.Row>
              <Table.Head scope="col">{sectionCopy.lecture}</Table.Head>
              <Table.Head scope="col">{sectionCopy.date}</Table.Head>
              <Table.Head scope="col">{sectionCopy.week}</Table.Head>
              <Table.Head scope="col">{sectionCopy.time}</Table.Head>
              <Table.Head scope="col">{sectionCopy.location}</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each datedEvents as event (event.id)}
              <Table.Row>
                <Table.Cell>
                  {lectureLabel(event)}
                </Table.Cell>
                <Table.Cell>
                  {formatYyyyMmDd(event.dateKey ?? event.date)}
                </Table.Cell>
                <Table.Cell>
                  {detailValue(event, sectionCopy.week)}
                </Table.Cell>
                <Table.Cell>{eventTime(event)}</Table.Cell>
                <Table.Cell>{eventLocation(event)}</Table.Cell>
              </Table.Row>
            {/each}
            {#each unscheduledCalendarEvents as event (event.id)}
              <Table.Row>
                <Table.Cell>
                  {event.kind === "exam"
                    ? sectionCopy.examEvent
                    : formatMessage(sectionCopy.lectureNumber, { num: "?" })}
                </Table.Cell>
                <Table.Cell>
                  {sectionCopy.dateTBD}
                </Table.Cell>
                <Table.Cell>
                  {detailValue(event, sectionCopy.week)}
                </Table.Cell>
                <Table.Cell>{eventTime(event)}</Table.Cell>
                <Table.Cell>{eventLocation(event)}</Table.Cell>
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
