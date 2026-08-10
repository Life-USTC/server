import { describe, expect, it, vi } from "vitest";
import {
  ensureStaticIdentityMigrationComplete,
  LEGACY_STATIC_IDENTITY_INDEXES,
} from "@/static-loader/identity-migration-state";

const SNAPSHOT_SHA = "a".repeat(64);

function transaction() {
  return {
    staticIdentityMigrationState: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $queryRawUnsafe: vi.fn(),
  };
}

describe("static identity migration state", () => {
  it("accepts a completed migration only after legacy indexes are gone", async () => {
    const tx = transaction();
    tx.staticIdentityMigrationState.findUnique.mockResolvedValue({
      id: "raw-jwid-v1",
    });
    tx.$queryRawUnsafe.mockResolvedValue([]);

    await expect(
      ensureStaticIdentityMigrationComplete(tx, {
        bootstrapEnabled: false,
        snapshotSha256: SNAPSHOT_SHA,
      }),
    ).resolves.toBeUndefined();
    expect(tx.staticIdentityMigrationState.create).not.toHaveBeenCalled();
  });

  it("never bootstraps the migration state over existing static data", async () => {
    const tx = transaction();
    tx.staticIdentityMigrationState.findUnique.mockResolvedValue(null);
    tx.$queryRawUnsafe.mockResolvedValue([{ present: true }]);

    await expect(
      ensureStaticIdentityMigrationComplete(tx, {
        bootstrapEnabled: true,
        snapshotSha256: SNAPSHOT_SHA,
      }),
    ).rejects.toThrow("has not completed");
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(tx.staticIdentityMigrationState.create).not.toHaveBeenCalled();
  });

  it("initializes an explicitly bootstrapped empty database", async () => {
    const tx = transaction();
    tx.staticIdentityMigrationState.findUnique.mockResolvedValue(null);
    tx.$queryRawUnsafe.mockResolvedValue([{ present: false }]);

    await ensureStaticIdentityMigrationComplete(tx, {
      bootstrapEnabled: true,
      snapshotSha256: SNAPSHOT_SHA,
    });

    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(
      LEGACY_STATIC_IDENTITY_INDEXES.length,
    );
    expect(tx.staticIdentityMigrationState.create).toHaveBeenCalledWith({
      data: {
        id: "raw-jwid-v1",
        snapshotSha256: SNAPSHOT_SHA,
        completedAt: expect.any(Date),
      },
    });
  });
});
