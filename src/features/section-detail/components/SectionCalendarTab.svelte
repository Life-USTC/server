<script lang="ts">
import { formatMessage } from "@/features/section-detail/lib/display";
import { formatShanghaiDate } from "@/lib/time/shanghai-format";
import SoftEmptyMessage from "$lib/components/SoftEmptyMessage.svelte";
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
</script>

{#if datedEvents.length > 0 || unscheduledCalendarEvents.length > 0}
  <div class="min-w-0 overflow-x-auto">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>{sectionCopy.lecture}</Table.Head>
          <Table.Head>{sectionCopy.date}</Table.Head>
          <Table.Head>{sectionCopy.week}</Table.Head>
          <Table.Head>{sectionCopy.time}</Table.Head>
          <Table.Head>{sectionCopy.location}</Table.Head>
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
{:else}
  <SoftEmptyMessage message={sectionCopy.calendarEmpty} />
{/if}
