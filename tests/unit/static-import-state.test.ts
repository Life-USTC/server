import { describe, expect, it, vi } from "vitest";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
} from "@/static-loader/import-state";

const OBSERVED_AT = new Date("2026-07-18T03:00:00.000Z");
const SNAPSHOT_SHA = "a".repeat(64);
const OTHER_SNAPSHOT_SHA = "b".repeat(64);

function stateClient() {
  return {
    staticImportState: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
}

function input(
  overrides: Partial<{ observedAt: Date; snapshotSha256: string }> = {},
) {
  return {
    observedAt: OBSERVED_AT,
    snapshotSha256: SNAPSHOT_SHA,
    ...overrides,
  };
}

describe("global static import state", () => {
  it("allows the first complete import without a bootstrap mode", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue(null);

    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).resolves.toBe(false);
  });

  it("recognizes the same completed snapshot", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue({
      snapshotGeneratedAt: OBSERVED_AT,
      snapshotSha256: SNAPSHOT_SHA,
    });

    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).resolves.toBe(true);
  });

  it("rejects older snapshots and changed content at the same time", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue({
      snapshotGeneratedAt: OBSERVED_AT,
      snapshotSha256: SNAPSHOT_SHA,
    });

    await expect(
      assertStaticImportStateAllowsSnapshot(
        tx,
        input({ observedAt: new Date("2026-07-17T03:00:00.000Z") }),
      ),
    ).rejects.toThrow("last committed snapshot");
    await expect(
      assertStaticImportStateAllowsSnapshot(
        tx,
        input({ snapshotSha256: OTHER_SNAPSHOT_SHA }),
      ),
    ).rejects.toThrow("already committed with SHA-256");
  });

  it("records completion only through the singleton row", async () => {
    const tx = stateClient();

    await recordStaticImportState(tx, input());

    expect(tx.staticImportState.upsert).toHaveBeenCalledWith({
      where: { id: "global" },
      create: {
        id: "global",
        snapshotGeneratedAt: OBSERVED_AT,
        snapshotSha256: SNAPSHOT_SHA,
      },
      update: {
        snapshotGeneratedAt: OBSERVED_AT,
        snapshotSha256: SNAPSHOT_SHA,
      },
    });
  });
});
