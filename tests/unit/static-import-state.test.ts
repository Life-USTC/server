import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
} from "@/static-loader/import-state";

const SNAPSHOT_SHA = "a".repeat(64);
const OTHER_SNAPSHOT_SHA = "b".repeat(64);
const OBSERVED_AT = new Date("2026-07-18T03:00:00.000Z");

function stateClient() {
  return {
    staticImportState: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
  };
}

function input(
  overrides: Partial<
    Parameters<typeof assertStaticImportStateAllowsSnapshot>[1]
  > = {},
) {
  return {
    bootstrapEnabled: false,
    dryRun: false,
    expectedSnapshotSha256: null,
    observedAt: OBSERVED_AT,
    retirementEnabled: false,
    snapshotSha256: SNAPSHOT_SHA,
    ...overrides,
  };
}

describe("global static import state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when the first import is not an explicit bootstrap", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue(null);

    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).rejects.toThrow("manual bootstrap");
    expect(tx.staticImportState.upsert).not.toHaveBeenCalled();
  });

  it("allows an uncommitted bootstrap dry run without an approval hash", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue(null);

    await expect(
      assertStaticImportStateAllowsSnapshot(
        tx,
        input({ bootstrapEnabled: true, dryRun: true }),
      ),
    ).resolves.toBeUndefined();
  });

  it("requires the exact hash and disables retirement for a committed bootstrap", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue(null);

    await expect(
      assertStaticImportStateAllowsSnapshot(
        tx,
        input({ bootstrapEnabled: true }),
      ),
    ).rejects.toThrow("required for a committed");
    await expect(
      assertStaticImportStateAllowsSnapshot(
        tx,
        input({
          bootstrapEnabled: true,
          expectedSnapshotSha256: OTHER_SNAPSHOT_SHA,
        }),
      ),
    ).rejects.toThrow("does not match downloaded snapshot");
    await expect(
      assertStaticImportStateAllowsSnapshot(
        tx,
        input({
          bootstrapEnabled: true,
          expectedSnapshotSha256: SNAPSHOT_SHA,
          retirementEnabled: true,
        }),
      ),
    ).rejects.toThrow("cannot run while bootstrapping");
    await expect(
      assertStaticImportStateAllowsSnapshot(
        tx,
        input({
          bootstrapEnabled: true,
          expectedSnapshotSha256: SNAPSHOT_SHA,
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects older snapshots and equal timestamps with different content", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue({
      snapshotGeneratedAt: new Date("2026-07-19T03:00:00.000Z"),
      snapshotSha256: SNAPSHOT_SHA,
    });

    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).rejects.toThrow("last committed snapshot");

    tx.staticImportState.findUnique.mockResolvedValue({
      snapshotGeneratedAt: OBSERVED_AT,
      snapshotSha256: OTHER_SNAPSHOT_SHA,
    });
    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).rejects.toThrow("already committed with SHA-256");
  });

  it("accepts an idempotent snapshot or a newer snapshot", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue({
      snapshotGeneratedAt: OBSERVED_AT,
      snapshotSha256: SNAPSHOT_SHA,
    });
    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).resolves.toBeUndefined();

    tx.staticImportState.findUnique.mockResolvedValue({
      snapshotGeneratedAt: new Date("2026-07-17T03:00:00.000Z"),
      snapshotSha256: OTHER_SNAPSHOT_SHA,
    });
    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).resolves.toBeUndefined();
  });

  it("records the watermark through the singleton upsert", async () => {
    const tx = stateClient();

    await recordStaticImportState(tx, {
      observedAt: OBSERVED_AT,
      snapshotSha256: SNAPSHOT_SHA,
    });

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
