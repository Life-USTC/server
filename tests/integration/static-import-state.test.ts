import { describe } from "vitest";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
  STATIC_IMPORT_TRANSFORM_REVISION,
} from "@/static-loader/import-state";
import { staticImporterTest as it } from "../shared/static-importer-fixture";

describe("global static import state persistence", () => {
  it("section.source-monotonic-revision", async ({
    isolatedDatabase: { owner: db },
    importer,
    protocolRuntime,
    expect,
  }) => {
    await protocolRuntime.run(async () => {
      const snapshotSha = "a".repeat(64);
      const otherSnapshotSha = "b".repeat(64);
      const observedAt = new Date("2026-07-18T03:00:00.000Z");

      await expect(
        importer.$transaction((tx) =>
          assertStaticImportStateAllowsSnapshot(tx, {
            observedAt,
            snapshotSha256: snapshotSha,
            transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
          }),
        ),
      ).resolves.toBe(false);
      await importer.$transaction((tx) =>
        recordStaticImportState(tx, {
          observedAt,
          snapshotSha256: snapshotSha,
          transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
        }),
      );

      await expect(
        db.staticImportState.findUnique({
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
        importer.$transaction((tx) =>
          assertStaticImportStateAllowsSnapshot(tx, {
            observedAt,
            snapshotSha256: snapshotSha,
            transformRevision: STATIC_IMPORT_TRANSFORM_REVISION + 1,
          }),
        ),
      ).resolves.toBe(false);
      await expect(
        importer.$transaction((tx) =>
          assertStaticImportStateAllowsSnapshot(tx, {
            observedAt,
            snapshotSha256: otherSnapshotSha,
            transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
          }),
        ),
      ).rejects.toThrow("already committed with SHA-256");
      await expect(
        importer.$transaction((tx) =>
          assertStaticImportStateAllowsSnapshot(tx, {
            observedAt: new Date("2026-07-17T03:00:00.000Z"),
            snapshotSha256: snapshotSha,
            transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
          }),
        ),
      ).rejects.toThrow("last committed snapshot");
    });
  });
});
