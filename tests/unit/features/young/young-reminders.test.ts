import { describe, expect, it } from "vitest";
import {
  youngEventState,
  youngReminderCandidates,
} from "@/features/young/server/young-notification-state";

const event = {
  name: "Workshop",
  location: "East campus",
  status: null,
  sourceMissing: false,
  applyStartAt: new Date("2026-09-15T08:00:00+08:00"),
  applyEndAt: new Date("2026-09-16T10:00:00+08:00"),
  startAt: new Date("2026-09-17T10:00:00+08:00"),
  endAt: new Date("2026-09-17T12:00:00+08:00"),
};
const settings = {
  createdAt: new Date("2026-09-14T00:00:00+08:00"),
  remindSignup: true,
  remindDeadline: true,
  remindStart: true,
};
describe("Young reminders", () => {
  it("opens the deadline reminder window exactly 24 hours before the deadline", () => {
    expect(
      youngReminderCandidates(
        event,
        settings,
        new Date("2026-09-15T09:59:59+08:00"),
      ).map((item) => item.kind),
    ).not.toContain("signup_deadline");
    expect(
      youngReminderCandidates(
        event,
        settings,
        new Date("2026-09-15T10:00:00+08:00"),
      ).map((item) => item.kind),
    ).toContain("signup_deadline");
    expect(youngReminderCandidates(event, settings, event.applyEndAt)).toEqual(
      [],
    );
  });
  it("does not notify about registration opening before the user subscribed", () => {
    expect(
      youngReminderCandidates(
        event,
        { ...settings, createdAt: new Date("2026-09-15T09:00:00+08:00") },
        new Date("2026-09-15T09:00:00+08:00"),
      ),
    ).toEqual([]);
  });
  it("honors disabled settings and suppresses missing-source and expired events", () => {
    const now = new Date("2026-09-17T09:30:00+08:00");
    expect(
      youngReminderCandidates(event, settings, now).map((item) => item.kind),
    ).toEqual(["event_start"]);
    expect(
      youngReminderCandidates(event, { ...settings, remindStart: false }, now),
    ).toEqual([]);
    expect(
      youngReminderCandidates({ ...event, sourceMissing: true }, settings, now),
    ).toEqual([]);
    expect(youngReminderCandidates(event, settings, event.startAt)).toEqual([]);
  });
  it("a moved start no longer uses the previous start reminder window", () => {
    const now = new Date("2026-09-17T09:30:00+08:00");
    expect(
      youngReminderCandidates(
        { ...event, startAt: new Date("2026-09-18T10:00:00+08:00") },
        settings,
        now,
      ),
    ).toEqual([]);
  });
  it("fingerprints material changes but ignores changing counts and fetch times", () => {
    const state = youngEventState(event);
    expect(youngEventState({ ...event, location: "West campus" })).not.toBe(
      state,
    );
    expect(youngEventState({ ...event, sourceMissing: true })).not.toBe(state);
    const refetched = { ...event, lastSeenAt: new Date(), appliedCount: 100 };
    expect(youngEventState(refetched)).toBe(state);
  });
});
