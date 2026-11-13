import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma-node/client";
import { syncYoungOrganizationSources } from "@/static-loader/young-organization-sources";
import type { YoungEventBuild } from "@/static-loader/young-plan";

const events = { findMany: vi.fn() };
const execute = vi.fn();
const tx = {
  youngEvent: events,
  $executeRawUnsafe: execute,
} as unknown as Prisma.TransactionClient;
const at = new Date("2030-01-02T00:00:00Z");
const build = (
  organizationSources?: YoungEventBuild["organizationSources"],
): YoungEventBuild => ({
  youngId: "008",
  name: "Source event",
  rawJson: "{}",
  isActive: true,
  organizationSources,
});
beforeEach(() => {
  vi.resetAllMocks();
  events.findMany.mockResolvedValue([{ id: 93, youngId: "008" }]);
});

describe("event-local Young organization source writes", () => {
  it("keeps opaque array IDs and roles separate using the event's actual integer key", async () => {
    await syncYoungOrganizationSources(
      tx,
      [
        build({
          sponsor: { ids: ["shared", "shared"], complete: true },
          organizer: { ids: ["shared", "a,b", "Ａ", "A"], complete: true },
        }),
      ],
      { sourceObservedAt: at, complete: true },
    );
    const [sql, ...params] = execute.mock.calls[0];
    expect(sql).not.toContain("a,b");
    expect(params).toEqual([
      93,
      "sponsor",
      "shared",
      at,
      93,
      "organizer",
      "shared",
      at,
      93,
      "organizer",
      "a,b",
      at,
      93,
      "organizer",
      "Ａ",
      at,
      93,
      "organizer",
      "A",
      at,
    ]);
    expect(JSON.parse(execute.mock.calls[1][1])).toEqual([
      { eventId: 93, role: "sponsor", ids: ["shared"] },
      { eventId: 93, role: "organizer", ids: ["shared", "a,b", "Ａ", "A"] },
    ]);
  });

  it("does not delete for a partial snapshot or an incomplete role", async () => {
    await syncYoungOrganizationSources(
      tx,
      [build({ organizer: { ids: ["a"], complete: true } })],
      { sourceObservedAt: at, complete: false },
    );
    await syncYoungOrganizationSources(
      tx,
      [build({ organizer: { ids: ["b"], complete: false } })],
      { sourceObservedAt: at, complete: true },
    );
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls.every(([sql]) => sql.startsWith("INSERT"))).toBe(
      true,
    );
  });

  it("distinguishes an explicit complete empty role from an unknown role", async () => {
    await syncYoungOrganizationSources(tx, [build()], {
      sourceObservedAt: at,
      complete: true,
    });
    expect(events.findMany).not.toHaveBeenCalled();
    await syncYoungOrganizationSources(
      tx,
      [build({ sponsor: { ids: [], complete: true } })],
      { sourceObservedAt: at, complete: true },
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(JSON.parse(execute.mock.calls[0][1])).toEqual([
      { eventId: 93, role: "sponsor", ids: [] },
    ]);
  });

  it("refuses a missing event or an invalid source time instead of fabricating identity or time", async () => {
    events.findMany.mockResolvedValue([]);
    await expect(
      syncYoungOrganizationSources(
        tx,
        [build({ sponsor: { ids: ["id"], complete: true } })],
        { sourceObservedAt: at, complete: true },
      ),
    ).rejects.toThrow("Missing imported Young event");
    await expect(
      syncYoungOrganizationSources(tx, [], {
        sourceObservedAt: new Date("invalid"),
        complete: true,
      }),
    ).rejects.toThrow("valid source timestamp");
    expect(execute).not.toHaveBeenCalled();
  });
});
