import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCachedCurrentSemesterMock } = vi.hoisted(() => ({
  getCachedCurrentSemesterMock: vi.fn(),
}));

vi.mock("@/features/catalog/server/academic-metadata-read-model", () => ({
  getAcademicMetadata: vi.fn(),
  getCachedCurrentSemester: getCachedCurrentSemesterMock,
  listSemesters: vi.fn(),
}));

vi.mock("@/lib/catalog-runtime-cache", () => ({
  CATALOG_EDGE_CACHE_TAG: "catalog",
  cachedCatalogRuntimeData: vi.fn(),
}));

describe("current semester REST route", () => {
  beforeEach(() => {
    getCachedCurrentSemesterMock.mockReset();
  });

  it("adds public catalog CDN headers to a successful response", async () => {
    getCachedCurrentSemesterMock.mockResolvedValue({ id: 1, jwId: 421 });
    const { getCurrentSemesterRoute } = await import(
      "@/lib/api/routes/academic-metadata-routes"
    );

    const response = await getCurrentSemesterRoute(
      new Date("2026-08-14T04:00:00.000Z"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=0");
    expect(response.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=43200",
    );
  });

  it("keeps a missing semester as an uncached 404", async () => {
    getCachedCurrentSemesterMock.mockResolvedValue(null);
    const { getCurrentSemesterRoute } = await import(
      "@/lib/api/routes/academic-metadata-routes"
    );

    const response = await getCurrentSemesterRoute();

    expect(response.status).toBe(404);
    expect(response.headers.has("Cloudflare-CDN-Cache-Control")).toBe(false);
  });
});
