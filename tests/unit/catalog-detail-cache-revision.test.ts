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

  it("uses the static import snapshot SHA prefix as the revision", async () => {
    findUniqueMock.mockResolvedValue({
      snapshotSha256:
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef01",
    });

    await expect(getCatalogDetailCacheRevision()).resolves.toBe(
      "abcdef0123456789",
    );
    await expect(getCatalogDetailCacheRevision()).resolves.toBe(
      "abcdef0123456789",
    );
    expect(findUniqueMock).toHaveBeenCalledOnce();
  });

  it("falls back to bootstrap when static import state is missing", async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(getCatalogDetailCacheRevision()).resolves.toBe("bootstrap");
  });

  it("traces only the revision origin read with fixed cache attributes", async () => {
    findUniqueMock.mockResolvedValue({ snapshotSha256: "abcdef0123456789" });
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
