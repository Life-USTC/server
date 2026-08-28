import { describe, expect, it, vi } from "vitest";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
  STATIC_IMPORT_TRANSFORM_REVISION,
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
  overrides: Partial<{
    observedAt: Date;
    snapshotSha256: string;
    transformRevision: number;
  }> = {},
) {
  return {
    observedAt: OBSERVED_AT,
    snapshotSha256: SNAPSHOT_SHA,
    transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
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
      transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
    });

    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).resolves.toBe(true);
  });

  it("reimports an unchanged snapshot after mapper semantics change", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue({
      snapshotGeneratedAt: OBSERVED_AT,
      snapshotSha256: SNAPSHOT_SHA,
      transformRevision: STATIC_IMPORT_TRANSFORM_REVISION - 1,
    });

    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).resolves.toBe(false);
  });

  it("rejects an importer older than the committed transform revision", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue({
      snapshotGeneratedAt: OBSERVED_AT,
      snapshotSha256: SNAPSHOT_SHA,
      transformRevision: STATIC_IMPORT_TRANSFORM_REVISION + 1,
    });

    await expect(
      assertStaticImportStateAllowsSnapshot(tx, input()),
    ).rejects.toThrow("revision 2 was already committed");
  });

  it("rejects older snapshots and changed content at the same time", async () => {
    const tx = stateClient();
    tx.staticImportState.findUnique.mockResolvedValue({
      snapshotGeneratedAt: OBSERVED_AT,
      snapshotSha256: SNAPSHOT_SHA,
      transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
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
        transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
      },
      update: {
        snapshotGeneratedAt: OBSERVED_AT,
        snapshotSha256: SNAPSHOT_SHA,
        transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
      },
    });
  });

  it("requires a positive integer transform revision", async () => {
    const tx = stateClient();

    await expect(
      assertStaticImportStateAllowsSnapshot(
        tx,
        input({ transformRevision: 0 }),
      ),
    ).rejects.toThrow("must be a positive integer");
    expect(tx.staticImportState.findUnique).not.toHaveBeenCalled();
  });
});
