import { afterAll, describe, expect, it } from "vitest";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
} from "@/static-loader/import-state";
import { createTestPrisma, disconnectTestPrisma } from "../shared/prisma";

const prisma = createTestPrisma();

afterAll(() => disconnectTestPrisma(prisma));

describe("global static import state persistence", () => {
  it("bootstraps once and rejects stale or conflicting snapshots", async () => {
    const rollback = new Error("ROLLBACK_STATIC_IMPORT_STATE_TEST");
    const snapshotSha = "a".repeat(64);
    const otherSnapshotSha = "b".repeat(64);
    const observedAt = new Date("2026-07-18T03:00:00.000Z");

    try {
      await prisma.$transaction(async (tx) => {
        await tx.staticImportState.deleteMany({ where: { id: "global" } });

        await expect(
          assertStaticImportStateAllowsSnapshot(tx, {
            bootstrapEnabled: false,
            dryRun: false,
            expectedSnapshotSha256: null,
            observedAt,
            retirementEnabled: false,
            snapshotSha256: snapshotSha,
          }),
        ).rejects.toThrow("manual bootstrap");

        await expect(
          assertStaticImportStateAllowsSnapshot(tx, {
            bootstrapEnabled: true,
            dryRun: false,
            expectedSnapshotSha256: snapshotSha,
            observedAt,
            retirementEnabled: false,
            snapshotSha256: snapshotSha,
          }),
        ).resolves.toBeUndefined();
        await recordStaticImportState(tx, {
          observedAt,
          snapshotSha256: snapshotSha,
        });

        await expect(
          tx.staticImportState.findUnique({
            where: { id: "global" },
            select: {
              snapshotGeneratedAt: true,
              snapshotSha256: true,
            },
          }),
        ).resolves.toEqual({
          snapshotGeneratedAt: observedAt,
          snapshotSha256: snapshotSha,
        });
        await expect(
          assertStaticImportStateAllowsSnapshot(tx, {
            bootstrapEnabled: false,
            dryRun: false,
            expectedSnapshotSha256: null,
            observedAt,
            retirementEnabled: false,
            snapshotSha256: otherSnapshotSha,
          }),
        ).rejects.toThrow("already committed with SHA-256");
        await expect(
          assertStaticImportStateAllowsSnapshot(tx, {
            bootstrapEnabled: false,
            dryRun: false,
            expectedSnapshotSha256: null,
            observedAt: new Date("2026-07-17T03:00:00.000Z"),
            retirementEnabled: false,
            snapshotSha256: snapshotSha,
          }),
        ).rejects.toThrow("last committed snapshot");

        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
  });
});
