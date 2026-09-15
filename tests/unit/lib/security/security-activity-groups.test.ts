import { describe, expect, it } from "vitest";
import { groupSecurityActivity } from "@/features/settings/lib/security-activity-groups";
import type { OwnAccountSecurityActivity } from "@/features/settings/server/account-activity";

function activity(
  id: string,
  createdAt: string,
  outcome: OwnAccountSecurityActivity["outcome"] = "success",
): OwnAccountSecurityActivity {
  return {
    action: "account_sign_in",
    channel: "auth",
    client: null,
    createdAt,
    device: "Chrome · Linux",
    id,
    network: "202.38.64.*",
    outcome,
  };
}

describe("groupSecurityActivity", () => {
  it("groups matching successful activity only within five minutes", () => {
    const groups = groupSecurityActivity([
      activity("event-newest", "2026-08-16T04:05:00.000Z"),
      activity("event-middle", "2026-08-16T04:03:00.000Z"),
      activity("event-oldest", "2026-08-16T04:00:00.000Z"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      count: 3,
      oldestCreatedAt: "2026-08-16T04:00:00.000Z",
    });
  });

  it("keeps successful activity outside the grouping window separate", () => {
    const groups = groupSecurityActivity([
      activity("event-newest", "2026-08-16T04:10:01.000Z"),
      activity("event-oldest", "2026-08-16T04:05:00.000Z"),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("never groups denied or failed security activity", () => {
    const groups = groupSecurityActivity([
      activity("failure-2", "2026-08-16T04:01:00.000Z", "failure"),
      activity("failure-1", "2026-08-16T04:00:00.000Z", "failure"),
      activity("denied-2", "2026-08-16T03:59:00.000Z", "denied"),
      activity("denied-1", "2026-08-16T03:58:00.000Z", "denied"),
    ]);

    expect(groups).toHaveLength(4);
    expect(groups.every((group) => group.count === 1)).toBe(true);
  });
});
