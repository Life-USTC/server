<script lang="ts">
import { formatMessage } from "@/features/section-detail/lib/display";
import {
  calendarEventDetail,
  calendarEventLocation,
  calendarEventTime,
} from "@/features/section-detail/lib/section-calendar-display";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import * as Empty from "$lib/components/ui/empty/index.js";
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
</script>

{#if datedEvents.length > 0 || unscheduledCalendarEvents.length > 0}
  <Table.Root
    class="min-w-[42rem] md:min-w-0"
    data-testid="section-calendar-table"
  >
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
          <Table.Cell class="whitespace-nowrap">{lectureLabel(event)}</Table.Cell>
          <Table.Cell class="whitespace-nowrap">
            {formatYyyyMmDd(event.dateKey ?? event.date) || sectionCopy.dateTBD}
          </Table.Cell>
          <Table.Cell class="whitespace-nowrap">
            {calendarEventDetail(event, sectionCopy.week, "—")}
          </Table.Cell>
          <Table.Cell class="whitespace-nowrap">
            {calendarEventTime(event, "—")}
          </Table.Cell>
          <Table.Cell class="whitespace-nowrap">
            {calendarEventLocation(event, "—")}
          </Table.Cell>
        </Table.Row>
      {/each}
      {#each unscheduledCalendarEvents as event (event.id)}
        <Table.Row>
          <Table.Cell class="whitespace-nowrap">{lectureLabel(event)}</Table.Cell>
          <Table.Cell class="whitespace-nowrap">{sectionCopy.dateTBD}</Table.Cell>
          <Table.Cell class="whitespace-nowrap">
            {calendarEventDetail(event, sectionCopy.week, "—")}
          </Table.Cell>
          <Table.Cell class="whitespace-nowrap">
            {calendarEventTime(event, "—")}
          </Table.Cell>
          <Table.Cell class="whitespace-nowrap">
            {calendarEventLocation(event, "—")}
          </Table.Cell>
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
{:else}
  <Empty.Root class="min-h-20 border-0 px-2 py-6">
    <Empty.Header>
      <Empty.Description>{sectionCopy.calendarEmpty}</Empty.Description>
    </Empty.Header>
  </Empty.Root>
{/if}
