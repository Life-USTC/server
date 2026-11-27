import { describe } from "vitest";
import {
  assertStaticImportStateAllowsSnapshot,
  recordStaticImportState,
  STATIC_IMPORT_TRANSFORM_REVISION,
} from "@/static-loader/import-state";
import { runManifestImport } from "@/static-loader/manifest-import";
import { staticImporterTest as it } from "../shared/static-importer-fixture";

describe("global static import state persistence", () => {
  it("section.source-monotonic-revision", {
    tags: ["@StaticImport/Service"],
  }, async ({
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

  it("section.source-manifest-fast-path", {
    tags: ["@StaticImport/Service"],
  }, async ({ importer, protocolRuntime, expect }) => {
    await protocolRuntime.run(async () => {
      const snapshotSha256 = "c".repeat(64);
      const generatedAt = "2026-11-26T00:00:00Z";
      await importer.$transaction((tx) =>
        recordStaticImportState(tx, {
          observedAt: new Date(generatedAt),
          snapshotSha256,
          transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
        }),
      );
      const manifest = {
        manifestVersion: 1,
        snapshotSchemaVersion: "6",
        generatedAt,
        health: "complete",
        sourceAvailability: {
          unavailableCurriculumSemesterJwIds: [],
          unavailableExamSemesterJwIds: [],
        },
        snapshot: { sha256: snapshotSha256, size: 10 },
        compressedSnapshot: {
          url: "snapshot.sqlite.gz",
          sha256: "d".repeat(64),
          size: 10,
        },
      };
      const report = await runManifestImport({
        prisma: importer,
        manifestUrl: "https://static.example.test/snapshot-manifest.json",
        cacheDir: "unused",
        dryRun: false,
        fetchImpl: async () => new Response(JSON.stringify(manifest)),
      });
      expect(report.outcome).toBe("unchanged");
      expect(report.snapshot.sha256).toBe(snapshotSha256);
    });
  });
});
