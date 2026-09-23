import { beforeEach, describe, expect, it, vi } from "vitest";

const { cachedCatalogRuntimeDataMock, semesterFindFirstMock } = vi.hoisted(
  () => ({
    cachedCatalogRuntimeDataMock: vi.fn(
      async (
        _namespace: string,
        _cacheKey: string,
        _origin: string,
        load: () => Promise<unknown>,
      ) => load(),
    ),
    semesterFindFirstMock: vi.fn(),
  }),
);

vi.mock("@/lib/catalog-runtime-cache", () => ({
  cachedCatalogRuntimeData: cachedCatalogRuntimeDataMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    semester: { findFirst: semesterFindFirstMock },
  },
}));

describe("current semester read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shares a revision-aware runtime cache key scoped to the Shanghai date", async () => {
    const semester = { id: 1, jwId: 421 };
    semesterFindFirstMock.mockResolvedValue(semester);
    const { getCachedCurrentSemester } = await import(
      "@/features/catalog/server/academic-metadata-read-model"
    );

    await expect(
      getCachedCurrentSemester(
        new Date("2026-08-14T15:59:59.000Z"),
        "https://life.example",
      ),
    ).resolves.toBe(semester);

    expect(cachedCatalogRuntimeDataMock).toHaveBeenCalledWith(
      "catalog:current-semester",
      "current-semester:2026-08-14",
      "https://life.example",
      expect.any(Function),
    );
    expect(semesterFindFirstMock).toHaveBeenCalledWith({
      where: {
        startDate: { lte: new Date("2026-08-14T00:00:00.000Z") },
        endDate: { gte: new Date("2026-08-14T00:00:00.000Z") },
      },
      orderBy: [
        { startDate: "desc" },
        { endDate: "asc" },
        { jwId: "desc" },
        { id: "desc" },
      ],
    });
  });

  it("also caches a missing result without changing its null semantics", async () => {
    semesterFindFirstMock.mockResolvedValue(null);
    const { getCachedCurrentSemester } = await import(
      "@/features/catalog/server/academic-metadata-read-model"
    );

    await expect(
      getCachedCurrentSemester(
        new Date("2026-08-15T00:00:00.000Z"),
        "https://life.example",
      ),
    ).resolves.toBeNull();
    expect(cachedCatalogRuntimeDataMock).toHaveBeenCalledTimes(1);
  });
});
