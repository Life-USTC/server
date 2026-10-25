import { describe, expect, it } from "vitest";
import { calendarConflictInterval } from "@/features/calendar/lib/calendar-conflict-interval";
import type { PersonalCalendarItem } from "@/features/young/lib/personal-calendar-client";
import { youngCalendarConflicts } from "@/features/young/lib/young-calendar-conflicts";
import { youngEventConflictIntervals } from "@/features/young/lib/young-event-conflict-intervals";

const occupied: PersonalCalendarItem = {
  id: "course-1",
  type: "schedule",
  youngId: null,
  title: "Class",
  at: "2026-09-15T10:00:00+08:00",
  endsAt: "2026-09-15T12:00:00+08:00",
  hasTime: true,
  conflictIntervals: [
    {
      startAt: "2026-09-15T10:00:00+08:00",
      endAt: "2026-09-15T12:00:00+08:00",
    },
  ],
  location: null,
  url: "/workspace/calendar",
};
const event = (
  youngId: string,
  startAt: string | null,
  endAt: string | null = null,
) => ({
  youngId,
  conflictIntervals: youngEventConflictIntervals({
    startAt,
    endAt,
    categoryCode: "0",
    formCode: "0",
    places: null,
  }),
});
describe("Young calendar conflict hints", () => {
  it("does not treat an unknown exam time as an all-day conflict", () => {
    expect(
      youngCalendarConflicts(
        [event("lecture", occupied.at, occupied.endsAt)],
        [{ ...occupied, type: "exam", hasTime: false }],
      ).size,
    ).toBe(0);
  });
  it("uses strict overlaps without inventing durations for point activities", () => {
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
    ]);
  });
  it("does not count the same subscription, deadlines, or unknown occupied durations", () => {
    const events = [event("same", occupied.at, occupied.endsAt)];
    expect(
      youngCalendarConflicts(events, [
        { ...occupied, type: "young_event", youngId: "same" },
        { ...occupied, type: "todo_due" },
        { ...occupied, endsAt: null, conflictIntervals: [] },
      ]).size,
    ).toBe(0);
  });
});

const precise = {
  startAt: "2026-09-15T10:00:00+08:00",
  endAt: "2026-09-15T12:00:00+08:00",
  categoryCode: "0",
  formCode: "0",
  places: null as unknown,
};
describe("known Young occupied intervals", () => {
  it("uses same-day single on-site times and ignores address-only records", () => {
    expect(youngEventConflictIntervals(precise)).toEqual(
      occupied.conflictIntervals,
    );
    expect(
      youngEventConflictIntervals({
        ...precise,
        places: [{ placeInfo: "Library", placeSt: null, placeEt: null }],
      }),
    ).toEqual(occupied.conflictIntervals);
  });
  it.each([
    { formCode: "1" },
    { categoryCode: "1" },
    { categoryCode: null },
    { formCode: null },
    { endAt: "2026-10-15T12:00:00+08:00" },
    { endAt: null },
    { startAt: "2026-09-15", endAt: "2026-09-16" },
    { startAt: "2026-02-30T10:00:00+08:00" },
    { endAt: "2026-09-15T09:00:00+08:00" },
    { endAt: precise.startAt },
  ])(
    "does not create conflicts in either direction for uncertain activity %j",
    (patch) => {
      const activity = { ...precise, ...patch };
      const conflictIntervals = youngEventConflictIntervals(activity);
      expect(conflictIntervals).toEqual([]);
      expect(
        youngCalendarConflicts(
          [{ youngId: "candidate", conflictIntervals }],
          [occupied],
        ).size,
      ).toBe(0);
      expect(
        youngCalendarConflicts(
          [event("candidate", precise.startAt, precise.endAt)],
          [
            {
              ...occupied,
              type: "young_event",
              youngId: "subscribed",
              at: activity.startAt,
              endsAt: activity.endAt,
              conflictIntervals,
            },
          ],
        ).size,
      ).toBe(0);
    },
  );
  it("keeps explicit overnight slots and gaps inside a series envelope", () => {
    const slots = youngEventConflictIntervals({
      ...precise,
      startAt: "2026-09-14T00:00:00+08:00",
      endAt: "2026-09-16T00:00:00+08:00",
      categoryCode: "1",
      places: [
        { placeSt: "2026-09-14 23:00:00", placeEt: "2026-09-15 01:00:00" },
        { placeSt: "2026-09-15 13:00:00", placeEt: "2026-09-15 14:00:00" },
      ],
    });
    expect(slots).toEqual([
      {
        startAt: "2026-09-14T23:00:00+08:00",
        endAt: "2026-09-15T01:00:00+08:00",
      },
      {
        startAt: "2026-09-15T13:00:00+08:00",
        endAt: "2026-09-15T14:00:00+08:00",
      },
    ]);
    expect(
      youngCalendarConflicts(
        [{ youngId: "series", conflictIntervals: slots }],
        [occupied],
      ).size,
    ).toBe(0);
    expect([
      ...youngCalendarConflicts(
        [
          event(
            "night",
            "2026-09-15T00:30:00+08:00",
            "2026-09-15T01:30:00+08:00",
          ),
        ],
        [
          {
            ...occupied,
            type: "young_event",
            youngId: "series",
            conflictIntervals: slots,
          },
        ],
      ),
    ]).toEqual(["night"]);
  });
  it.each([
    { placeSt: "2026-09-15 10:15:00" },
    { placeSt: "", placeEt: "" },
    { placeSt: "2026-09-15", placeEt: "2026-09-16" },
    { placeSt: "2026-02-30 10:15:00", placeEt: "2026-09-15 11:15:00" },
    { placeSt: "2026-09-15 09:00:00", placeEt: "2026-09-15 11:15:00" },
    { placeSt: "2026-09-15 11:00:00", placeEt: "2026-09-15 13:00:00" },
    { placeSt: "2026-09-15 11:00:00", placeEt: "2026-09-15 10:00:00" },
  ])(
    "does not fall back from incomplete, invalid or contradictory slots %j",
    (place) => {
      expect(
        youngEventConflictIntervals({ ...precise, places: [place] }),
      ).toEqual([]);
    },
  );
  it("compares Shanghai dates rather than the original timezone or runtime day", () => {
    expect(
      youngEventConflictIntervals({
        ...precise,
        startAt: "2026-09-14T23:00:00Z",
        endAt: "2026-09-15T01:00:00Z",
      }),
    ).toEqual([
      {
        startAt: "2026-09-15T07:00:00+08:00",
        endAt: "2026-09-15T09:00:00+08:00",
      },
    ]);
    expect(
      youngEventConflictIntervals({
        ...precise,
        startAt: "2026-09-15T15:00:00Z",
        endAt: "2026-09-15T17:00:00Z",
      }),
    ).toEqual([]);
    expect(
      calendarConflictInterval("2026-09-15 10:00", "2026-09-15 11:00"),
    ).toEqual(
      [{ startAt: precise.startAt, endAt: "2026-09-15T11:00:00+08:00" }][0],
    );
  });
});
