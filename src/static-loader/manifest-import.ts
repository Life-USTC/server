import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import type { PrismaClient } from "../generated/prisma-node/client";
import { acquireStaticImportLock } from "./import-lock";
import {
  assertStaticImportStateAllowsSnapshot,
  STATIC_IMPORT_TRANSFORM_REVISION,
} from "./import-state";
import type { ImportReport } from "./import-types";
import {
  readStaticSnapshotManifest,
  type SnapshotFetch,
  type StaticSnapshotManifest,
  snapshotArtifactUrl,
} from "./manifest";
import { parseSnapshotGeneratedAt } from "./validation";

async function sha256File(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function download(url: string, path: string, fetchImpl: SnapshotFetch) {
  const response = await fetchImpl(url);
  if (!response.ok || !response.body) {
    throw new Error(`Snapshot download failed (HTTP ${response.status})`);
  }
  const temporary = `${path}.${randomUUID()}.download`;
  try {
    await pipeline(
      Readable.fromWeb(
        response.body as import("node:stream/web").ReadableStream,
      ),
      createWriteStream(temporary),
    );
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function validArtifact(path: string, sha256: string, size: number) {
  if (!existsSync(path)) return false;
  const info = await stat(path);
  return info.size === size && (await sha256File(path)) === sha256;
}

export async function materializeManifestSnapshot(input: {
  manifest: StaticSnapshotManifest;
  manifestUrl: string;
  cacheDir: string;
  fetchImpl?: SnapshotFetch;
}) {
  const { manifest, cacheDir } = input;
  const fetchImpl = input.fetchImpl ?? fetch;
  await mkdir(cacheDir, { recursive: true });
  const raw = `${cacheDir}/${manifest.snapshot.sha256}.sqlite`;
  if (
    await validArtifact(raw, manifest.snapshot.sha256, manifest.snapshot.size)
  ) {
    return raw;
  }
  await rm(raw, { force: true });
  const compressed = `${cacheDir}/${manifest.compressedSnapshot.sha256}.sqlite.gz`;
  if (
    !(await validArtifact(
      compressed,
      manifest.compressedSnapshot.sha256,
      manifest.compressedSnapshot.size,
    ))
  ) {
    await rm(compressed, { force: true });
    await download(
      snapshotArtifactUrl(input.manifestUrl, manifest.compressedSnapshot.url),
      compressed,
      fetchImpl,
    );
    if (
      !(await validArtifact(
        compressed,
        manifest.compressedSnapshot.sha256,
        manifest.compressedSnapshot.size,
      ))
    ) {
      throw new Error(
        "Compressed snapshot digest or size does not match manifest",
      );
    }
  }
  const temporary = `${raw}.${randomUUID()}.decompress`;
  try {
    await pipeline(
      createReadStream(compressed),
      createGunzip(),
      createWriteStream(temporary),
    );
    await rename(temporary, raw);
  } finally {
    await rm(temporary, { force: true });
  }
  if (
    !(await validArtifact(
      raw,
      manifest.snapshot.sha256,
      manifest.snapshot.size,
    ))
  ) {
    await rm(raw, { force: true });
    throw new Error("Snapshot digest or size does not match manifest");
  }
  return raw;
}

async function alreadyApplied(
  prisma: PrismaClient,
  manifest: StaticSnapshotManifest,
): Promise<ImportReport | null> {
  const applied = await prisma.$transaction(
    async (tx) => {
      await acquireStaticImportLock(tx);
      return assertStaticImportStateAllowsSnapshot(tx, {
        observedAt: parseSnapshotGeneratedAt(manifest.generatedAt),
        snapshotSha256: manifest.snapshot.sha256,
        transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
      });
    },
    { maxWait: 60_000, timeout: 60_000 },
  );
  if (!applied) return null;
  return {
    mode: "apply",
    outcome: "unchanged",
    snapshot: {
      sha256: manifest.snapshot.sha256,
      schemaVersion: manifest.snapshotSchemaVersion,
      generatedAt: manifest.generatedAt,
    },
    sourceAvailability: manifest.sourceAvailability,
    plannedRecordCounts: null,
    databaseRecordCounts: null,
    reconciliation: { sectionPresence: { status: "already-applied" } },
  };
}

export async function runManifestImport(input: {
  prisma: PrismaClient;
  manifestUrl: string;
  cacheDir: string;
  dryRun: boolean;
  fetchImpl?: SnapshotFetch;
}) {
  const manifest = await readStaticSnapshotManifest(
    input.manifestUrl,
    input.fetchImpl,
  );
  if (manifest.snapshotSchemaVersion !== "6") {
    throw new Error(
      `Unsupported snapshot schema version: ${manifest.snapshotSchemaVersion}`,
    );
  }
  console.log(
    `Snapshot manifest: ${manifest.generatedAt} ${manifest.snapshot.sha256} (${manifest.health})`,
  );
  if (!input.dryRun) {
    const report = await alreadyApplied(input.prisma, manifest);
    if (report) return report;
  }
  const snapshotPath = await materializeManifestSnapshot({
    manifest,
    manifestUrl: input.manifestUrl,
    cacheDir: input.cacheDir,
    fetchImpl: input.fetchImpl,
  });
  const { runImport } = await import("./import");
  return runImport(input.prisma, {
    snapshotPath,
    snapshotSha256: manifest.snapshot.sha256,
    dryRun: input.dryRun,
  });
}
