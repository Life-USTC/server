import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma-node/client";

const write = vi.hoisted(() => vi.fn());
vi.mock("@/static-loader/database-writes", () => ({ bulkUpsert: write }));

import {
  syncYoungEvents,
  syncYoungSnapshot,
} from "@/static-loader/import-young";

const organizer = { createMany: vi.fn(), findMany: vi.fn() };
const events = { updateMany: vi.fn() };
const tx = {
  youngOrganizer: organizer,
  youngEvent: events,
  staticImportState: { findUnique: vi.fn() },
} as unknown as Prisma.TransactionClient;
beforeEach(() => vi.resetAllMocks());
describe("Young static import identity and preservation", () => {
  it("groups equivalent organizer labels by exact normalized identity and preserves observed source timestamps", async () => {
    organizer.findMany.mockResolvedValue([
      { id: "club", normalizedName: "club a" },
    ]);
    const seen = new Date("2035-09-15T02:00:00Z");
    await syncYoungEvents(
      tx,
      [
        {
          youngId: "1",
          name: "A",
          organizer: " Ｃｌｕｂ  A ",
          isActive: true,
          rawJson: "{}",
        },
        {
          youngId: "2",
          name: "B",
          organizer: "club a",
          isActive: false,
          rawJson: "{}",
        },
      ],
      { observedAt: seen, complete: true },
    );
    expect(organizer.createMany).toHaveBeenCalledWith({
      data: [{ normalizedName: "club a", name: "club a" }],
      skipDuplicates: true,
    });
    const columns = write.mock.calls[0][4] as string[];
    const records = write.mock.calls[0][6] as Array<{
      key: string;
      values: unknown[];
    }>;
    expect(
      records.map((row) => [
        row.key,
        row.values[columns.indexOf("organizerId")],
        row.values[columns.indexOf("lastSeenAt")],
      ]),
    ).toEqual([
      ["1", "club", seen],
      ["2", "club", seen],
    ]);
    expect(events.updateMany).toHaveBeenCalledWith({
      where: { youngId: { notIn: ["1", "2"] } },
      data: { sourceMissing: true },
    });
  });
  it("imports records without an organizer without fabricating one or reconciling missing rows from partial data", async () => {
    await syncYoungEvents(tx, [
      {
        youngId: "1",
        name: "A",
        organizer: "  ",
        isActive: true,
        rawJson: "{}",
      },
    ]);
    expect(organizer.createMany).not.toHaveBeenCalled();
    expect(events.updateMany).not.toHaveBeenCalled();
  });
  it("retains activity rows even when a complete snapshot is empty", async () => {
    await syncYoungEvents(tx, [], { complete: true });
    expect(events.updateMany).toHaveBeenCalledWith({
      where: {},
      data: { sourceMissing: true },
    });
  });
});

describe("Young snapshot freshness", () => {
  it("does not reconcile or rewrite reused, missing, or older Young snapshots", async () => {
    const last = new Date("2035-09-15T01:00:00Z");
    vi.mocked(tx.staticImportState.findUnique).mockResolvedValue({
      youngSyncedAt: last,
    } as never);
    for (const timestamp of [
      undefined,
      last,
      new Date("2035-09-14T01:00:00Z"),
    ]) {
      expect(await syncYoungSnapshot(tx, [], timestamp)).toBeUndefined();
    }
    expect(write).not.toHaveBeenCalled();
    expect(events.updateMany).not.toHaveBeenCalled();
  });
  it("reconciles a newly successful fetch using its own timestamp", async () => {
    vi.mocked(tx.staticImportState.findUnique).mockResolvedValue(null);
    const fetched = new Date("2035-09-15T01:00:00Z");
    expect(await syncYoungSnapshot(tx, [], fetched)).toEqual(fetched);
    expect(events.updateMany).toHaveBeenCalledWith({
      where: {},
      data: { sourceMissing: true },
    });
  });
});
