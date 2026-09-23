import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithCloudflareRuntimeEnv } from "@/lib/adapters/cloudflare-runtime";
import {
  getCatalogDetailCacheRevision,
  resetCatalogDetailCacheRevisionForTest,
} from "@/lib/catalog-detail-cache-revision";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    staticImportState: {
      findUnique: findUniqueMock,
    },
  },
}));

describe("catalog detail cache revision", () => {
  afterEach(() => {
    resetCatalogDetailCacheRevisionForTest();
    findUniqueMock.mockReset();
  });

  it("uses the snapshot SHA and committed materialization time as the revision", async () => {
    findUniqueMock.mockResolvedValue({
      snapshotSha256:
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef01",
      updatedAt: new Date("2026-08-16T03:00:00.000Z"),
    });

    await expect(getCatalogDetailCacheRevision()).resolves.toBe(
      "abcdef0123456789-msv7vmo0",
    );
    await expect(getCatalogDetailCacheRevision()).resolves.toBe(
      "abcdef0123456789-msv7vmo0",
    );
    expect(findUniqueMock).toHaveBeenCalledOnce();
  });

  it("changes revision when the same snapshot is rematerialized", async () => {
    findUniqueMock.mockResolvedValue({
      snapshotSha256: "abcdef0123456789",
      updatedAt: new Date("2026-08-16T03:00:00.000Z"),
    });
    const first = await getCatalogDetailCacheRevision();

    resetCatalogDetailCacheRevisionForTest();
    findUniqueMock.mockResolvedValue({
      snapshotSha256: "abcdef0123456789",
      updatedAt: new Date("2026-08-16T03:01:00.000Z"),
    });

    await expect(getCatalogDetailCacheRevision()).resolves.not.toBe(first);
  });

  it("falls back to bootstrap when static import state is missing", async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(getCatalogDetailCacheRevision()).resolves.toBe("bootstrap");
  });

  it("traces only the revision origin read with fixed cache attributes", async () => {
    findUniqueMock.mockResolvedValue({
      snapshotSha256: "abcdef0123456789",
      updatedAt: new Date("2026-08-16T03:00:00.000Z"),
    });
    const setAttribute = vi.fn();
    const enterSpan = vi.fn(
      <T>(
        name: string,
        callback: (span: { setAttribute: typeof setAttribute }) => T,
      ) => {
        expect(name).toBe("cache.catalog_revision.read");
        return callback({ setAttribute });
      },
    );

    await runWithCloudflareRuntimeEnv(
      {},
      async () => {
        await getCatalogDetailCacheRevision();
        await getCatalogDetailCacheRevision();
      },
      { tracing: { enterSpan } },
    );

    expect(enterSpan).toHaveBeenCalledOnce();
    expect(setAttribute.mock.calls).toEqual([
      ["cache.layer", "origin"],
      ["cache.namespace", "catalog:revision"],
      ["cache.outcome", "success"],
    ]);
  });
});
