import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/static-loader/import", () => ({ runImport: vi.fn() }));

import type { PrismaClient } from "@/generated/prisma-node/client";
import { STATIC_IMPORT_TRANSFORM_REVISION } from "@/static-loader/import-state";
import {
  readStaticSnapshotManifest,
  snapshotArtifactUrl,
  staticSnapshotManifestSchema,
} from "@/static-loader/manifest";
import {
  materializeManifestSnapshot,
  runManifestImport,
} from "@/static-loader/manifest-import";

function digest(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function fixture(raw: Buffer, compressed: Buffer) {
  return staticSnapshotManifestSchema.parse({
    manifestVersion: 1,
    snapshotSchemaVersion: "6",
    generatedAt: "2026-11-26T00:00:00Z",
    health: "degraded",
    sourceAvailability: {
      unavailableCurriculumSemesterJwIds: [],
      unavailableExamSemesterJwIds: [362],
    },
    snapshot: {
      sha256: digest(raw),
      size: raw.length,
    },
    compressedSnapshot: {
      url: "life-ustc-static.sqlite.gz",
      sha256: digest(compressed),
      size: compressed.length,
    },
  });
}

describe("static snapshot manifest", () => {
  it("validates, downloads once, and reuses verified raw bytes", async () => {
    const directory = mkdtempSync(join(tmpdir(), "snapshot-manifest-test-"));
    const raw = Buffer.from("SQLite format 3\0fixture");
    const compressed = gzipSync(raw);
    const manifest = fixture(raw, compressed);
    let downloads = 0;
    const fetchImpl = async () => {
      downloads += 1;
      return new Response(compressed);
    };
    try {
      const first = await materializeManifestSnapshot({
        manifest,
        manifestUrl: "https://static.example.test/snapshot-manifest.json",
        cacheDir: directory,
        fetchImpl: fetchImpl as typeof fetch,
      });
      expect(readFileSync(first)).toEqual(raw);
      const second = await materializeManifestSnapshot({
        manifest,
        manifestUrl: "https://static.example.test/snapshot-manifest.json",
        cacheDir: directory,
        fetchImpl: fetchImpl as typeof fetch,
      });
      expect(second).toBe(first);
      expect(downloads).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("skips all artifact downloads when the generation is already applied", async () => {
    const raw = Buffer.from("fixture");
    const manifest = fixture(raw, gzipSync(raw));
    const tx = {
      $queryRaw: async () => [{ acquired: true }],
      staticImportState: {
        findUnique: async () => ({
          snapshotGeneratedAt: new Date(manifest.generatedAt),
          snapshotSha256: manifest.snapshot.sha256,
          transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
        }),
      },
    };
    const prisma = {
      $transaction: async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
    } as unknown as PrismaClient;
    const report = await runManifestImport({
      prisma,
      manifestUrl: "https://static.example.test/snapshot-manifest.json",
      cacheDir: "unused",
      dryRun: false,
      fetchImpl: async () => new Response(JSON.stringify(manifest)),
    });
    expect(report.outcome).toBe("unchanged");
    expect(report.sourceAvailability.unavailableExamSemesterJwIds).toEqual([
      362,
    ]);
  });

  it("reads bounded metadata and rejects credentialed artifact URLs", async () => {
    const raw = Buffer.from("fixture");
    const manifest = fixture(raw, gzipSync(raw));
    await expect(
      readStaticSnapshotManifest(
        "https://static.example.test/snapshot-manifest.json",
        async () => new Response(JSON.stringify(manifest)),
      ),
    ).resolves.toEqual(manifest);
    expect(
      snapshotArtifactUrl(
        "https://static.example.test/snapshot-manifest.json",
        "life-ustc-static.sqlite.gz",
      ),
    ).toBe("https://static.example.test/life-ustc-static.sqlite.gz");
    expect(() =>
      snapshotArtifactUrl(
        "https://static.example.test/snapshot-manifest.json",
        "https://user:secret@example.test/snapshot",
      ),
    ).toThrow("credential-free");
  });
});
