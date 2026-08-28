import { afterAll, describe, expect, it } from "vitest";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
  STATIC_IMPORT_TRANSFORM_REVISION,
} from "@/static-loader/import-state";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();

afterAll(() => disconnectTestPrisma(prisma));

describe("global static import state persistence", () => {
  it("accepts the first snapshot and rejects stale or conflicting snapshots", async () => {
    const rollback = new Error("ROLLBACK_STATIC_IMPORT_STATE_TEST");
    const snapshotSha = "a".repeat(64);
    const otherSnapshotSha = "b".repeat(64);
    const observedAt = new Date("2026-07-18T03:00:00.000Z");

    try {
      await prisma.$transaction(async (tx) => {
        await tx.staticImportState.deleteMany({ where: { id: "global" } });

        await expect(
          assertStaticImportStateAllowsSnapshot(tx, {
            observedAt,
            snapshotSha256: snapshotSha,
            transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
          }),
        ).resolves.toBe(false);
        await recordStaticImportState(tx, {
          observedAt,
          snapshotSha256: snapshotSha,
          transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
        });

        await expect(
          tx.staticImportState.findUnique({
            where: { id: "global" },
            select: {
              snapshotGeneratedAt: true,
              snapshotSha256: true,
              transformRevision: true,
            },
          }),
        ).resolves.toEqual({
          snapshotGeneratedAt: observedAt,
          snapshotSha256: snapshotSha,
          transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
        });
        await expect(
          assertStaticImportStateAllowsSnapshot(tx, {
            observedAt,
            snapshotSha256: snapshotSha,
            transformRevision: STATIC_IMPORT_TRANSFORM_REVISION + 1,
          }),
        ).resolves.toBe(false);
        await expect(
          assertStaticImportStateAllowsSnapshot(tx, {
            observedAt,
            snapshotSha256: otherSnapshotSha,
            transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
          }),
        ).rejects.toThrow("already committed with SHA-256");
        await expect(
          assertStaticImportStateAllowsSnapshot(tx, {
            observedAt: new Date("2026-07-17T03:00:00.000Z"),
            snapshotSha256: snapshotSha,
            transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
          }),
        ).rejects.toThrow("last committed snapshot");

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
