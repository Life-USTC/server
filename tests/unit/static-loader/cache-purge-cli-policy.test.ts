import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { PUBLIC_SSR_CACHE_PURGE_PATH } from "@/lib/cloudflare/public-ssr-cache-purge-contract";

import { STATIC_IMPORT_TRANSFORM_REVISION } from "@/static-loader/import-state";

const { runImport, disconnect, findUnique, upsert } = vi.hoisted(() => ({
  runImport: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  disconnect: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/static-loader/import", () => ({ runImport }));
vi.mock("@/static-loader/prisma", () => ({
  createPrismaClient: () => ({
    $disconnect: disconnect,
    staticImportState: { findUnique, upsert },
  }),
}));
vi.mock("@/static-loader/snapshot", () => ({
  Snapshot: class {
    metadata() {
      return { version: 1 };
    }
    close() {}
  },
}));

it("rendering-and-cache.cache-layers-and-invalidation-6", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cache-purge-cli-"));
  const snapshot = join(directory, "snapshot.sqlite");
  const stats = join(directory, "stats.json");
  const exitCode = process.exitCode;
  try {
    await writeFile(snapshot, "unchanged snapshot fixture");
    for (const [name, value] of Object.entries({
      DATABASE_URL: "postgres://fixture:fixture@localhost/disposable",
      STATIC_SNAPSHOT_PATH: snapshot,
      STATIC_LOADER_STATS_FILE: stats,
      STATIC_LOADER_DRY_RUN: "false",
      CLOUDFLARE_ZONE_ID: "zone-1",
      CLOUDFLARE_API_TOKEN: "test-token",
      APP_PUBLIC_ORIGIN: "https://life-ustc.test",
      EDGE_CACHE_PURGE_SECRET: "test-purge-secret",
    }))
      vi.stubEnv(name, value);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () => new Response("unavailable", { status: 503 }),
      );
    const snapshotSha256 = "fixture-generation";
    const generation = {
      snapshotSha256,
      transformRevision: STATIC_IMPORT_TRANSFORM_REVISION,
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    findUnique.mockResolvedValueOnce(generation);
    const report = {
      outcome: "committed",
      snapshot: { sha256: snapshotSha256 },
    };
    runImport.mockResolvedValue(report);
    process.exitCode = 0;
    await import("@/static-loader/cli");
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1));
    expect(process.exitCode).toBe(1);
    expect(JSON.parse(await readFile(stats, "utf8"))).toEqual(report);
    expect(fetch).toHaveBeenCalledTimes(2);

    vi.resetModules();
    expect(upsert).not.toHaveBeenCalled();
    findUnique.mockResolvedValueOnce(generation).mockResolvedValueOnce(null);
    runImport.mockResolvedValue({ ...report, outcome: "unchanged" });
    fetch.mockImplementation(async () => Response.json({ success: true }));
    process.exitCode = 0;
    await import("@/static-loader/cli");
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledTimes(2));
    expect(process.exitCode).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(4);
    for (const calls of [
      fetch.mock.calls.slice(0, 2),
      fetch.mock.calls.slice(2),
    ]) {
      expect(calls.map(([url]) => String(url))).toEqual(
        expect.arrayContaining([
          "https://api.cloudflare.com/client/v4/zones/zone-1/purge_cache",
          `https://life-ustc.test${PUBLIC_SSR_CACHE_PURGE_PATH}`,
        ]),
      );
    }
    expect(upsert).toHaveBeenCalledTimes(1);
    vi.resetModules();
    findUnique
      .mockResolvedValueOnce(generation)
      .mockResolvedValueOnce(upsert.mock.calls[0][0].create);
    await import("@/static-loader/cli");
    await vi.waitFor(() => expect(disconnect).toHaveBeenCalledTimes(3));
    expect(process.exitCode).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(runImport.mock.calls[0][1].snapshotSha256).toBe(
      runImport.mock.calls[1][1].snapshotSha256,
    );
  } finally {
    process.exitCode = exitCode;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  }
});
