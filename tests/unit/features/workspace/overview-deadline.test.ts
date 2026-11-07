import { describe, expect, it } from "vitest";
import { overviewDeadlineOverdue } from "@/features/workspace/lib/overview-deadline";

describe("overview deadline badge", () => {
  const reference = "2026-11-07T09:00:00+08:00";
  it.each([
    ["2026-10-26T09:00:00+08:00", true],
    ["2026-11-07T08:59:59+08:00", true],
    ["2026-11-07T09:00:00+08:00", true],
    ["2026-11-07T09:00:01+08:00", false],
    ["2026-11-08T09:00:00+08:00", false],
    [null, false],
    ["invalid", false],
  ])("uses the task-list instant contract for %s", (dueAt, overdue) => {
    expect(overviewDeadlineOverdue({ dueAt, reference })).toBe(overdue);
    expect(overviewDeadlineOverdue({ dueAt, reference, completed: true })).toBe(
      false,
    );
    expect(
      overviewDeadlineOverdue({ dueAt, reference, completionRequired: false }),
    ).toBe(false);
  });
});
