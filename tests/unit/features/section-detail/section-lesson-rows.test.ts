import { expect, it } from "vitest";
import type { SectionCalendarEvent } from "@/features/section-detail/lib/calendar";
import { sectionLessonRows } from "@/features/section-detail/lib/section-calendar-display";

function lesson(
  id: string,
  week: number,
  day: string,
  time: string,
): SectionCalendarEvent {
  return {
    id,
    kind: "class",
    date: day,
    dateKey: day,
    meta: time,
    title: "",
    badges: [],
    sortValue: 0,
    details: [{ label: "Week", value: String(week) }],
  };
}

it("merges adjacent week and date/time cells independently and retains every lesson", () => {
  const first = lesson("A", 1, "2026-09-01", "08:00–09:00");
  const rows = sectionLessonRows(
    [
      lesson("D", 2, "2026-09-08", "08:00–09:00"),
      first,
      { ...first, id: "B" },
      { ...first, id: "C" },
      { ...first, id: "exam", kind: "exam" },
      lesson("later", 1, "2026-09-02", "08:00–09:00"),
    ],
    "Week",
  );
  expect(rows.map((row) => [row.event.id, row.weekSpan, row.timeSpan])).toEqual(
    [
      ["A", 4, 3],
      ["B", 0, 0],
      ["C", 0, 0],
      ["later", 0, 1],
      ["D", 1, 1],
    ],
  );
});
