import { describe, expect, it } from "vitest";
import {
  youngEventState,
  youngReminderCandidates,
} from "@/features/young/server/young-notification-state";
import { bindDomainOperation } from "../../../shared/specifications/domain-contracts";
import { semanticContract } from "../../../shared/specifications/semantic-contract";

const event = {
  name: "Workshop",
  location: "East campus",
  signupStatusCode: null,
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
  async function observeWindow(
    id: string,
    anchor: "applyEndAt" | "startAt",
    kind: "signup_deadline" | "event_start",
    lead: number,
    context: Parameters<
      Awaited<ReturnType<typeof semanticContract>>["recordVitest"]
    >[0],
  ) {
    const contract = await semanticContract(id, "reminder_window");
    const candidates = bindDomainOperation(
      contract,
      "src/features/young/server/young-notification-state.ts",
      youngReminderCandidates,
    );
    const closes = event[anchor].getTime();
    const opens = closes - lead;
    const selected = (now: number) =>
      candidates(event, settings, new Date(now)).find(
        (item) => item.kind === kind,
      );
    contract.equal("/before_window", Boolean(selected(opens - 1)));
    const first = selected(opens);
    expect(first).toBeDefined();
    contract.equal("/at_open", Boolean(first));
    contract.equal("/before_close", Boolean(selected(closes - 1)));
    contract.equal("/at_close", Boolean(selected(closes)));
    contract.equal("/lead_seconds", (first?.lead ?? -1) / 1000);
    contract.equal("/notification", first?.kind);
    contract.equal(
      "/anchor",
      Object.entries(event).find(([, value]) => value === first?.at)?.[0],
    );
    contract.recordVitest(context);
  }
  it("young-workspace.reminder-deadline-window", async (context) => {
    await observeWindow(
      "young-workspace.reminder-deadline-window",
      "applyEndAt",
      "signup_deadline",
      24 * 60 * 60 * 1000,
      context,
    );
  });
  it("young-workspace.reminder-start-window", async (context) => {
    await observeWindow(
      "young-workspace.reminder-start-window",
      "startAt",
      "event_start",
      60 * 60 * 1000,
      context,
    );
  });
  it("young-workspace.reminders", () => {
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
