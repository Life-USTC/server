import { describe, expect, it } from "vitest";
import type { PersonalCalendarItem } from "@/features/young/lib/personal-calendar-client";
import { youngCalendarConflicts } from "@/features/young/lib/young-calendar-conflicts";

const occupied: PersonalCalendarItem = {
  id: "course-1",
  type: "schedule",
  youngId: null,
  title: "Class",
  at: "2026-09-15T10:00:00+08:00",
  endsAt: "2026-09-15T12:00:00+08:00",
  location: null,
  url: "/workspace/calendar",
};
const event = (
  youngId: string,
  startAt: string | null,
  endAt: string | null = null,
) => ({ youngId, startAt, endAt });
describe("Young calendar conflict hints", () => {
  it("uses strict overlaps, including known-start point activities", () => {
    const events = [
      event(
        "overlap",
        "2026-09-15T11:00:00+08:00",
        "2026-09-15T13:00:00+08:00",
      ),
      event("point", "2026-09-15T10:00:00+08:00"),
      event(
        "touch-before",
        "2026-09-15T09:00:00+08:00",
        "2026-09-15T10:00:00+08:00",
      ),
      event("touch-after", "2026-09-15T12:00:00+08:00"),
      event("unknown", null),
    ];
    expect([...youngCalendarConflicts(events, [occupied])]).toEqual([
      "overlap",
      "point",
    ]);
  });
  it("does not count the same subscription, deadlines, or unknown occupied durations", () => {
    const events = [event("same", occupied.at, occupied.endsAt)];
    expect(
      youngCalendarConflicts(events, [
        { ...occupied, type: "young_event", youngId: "same" },
        { ...occupied, type: "todo_due" },
        { ...occupied, endsAt: null },
      ]).size,
    ).toBe(0);
  });
});
