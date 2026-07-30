import { afterEach, describe, expect, it, vi } from "vitest";
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
});
