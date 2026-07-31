import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  searchCoursesForGlobalMock,
  searchSectionsForGlobalMock,
  searchTeachersForGlobalMock,
  withUserDbContextMock,
  cachedCatalogRuntimeDataMock,
} = vi.hoisted(() => ({
  searchCoursesForGlobalMock: vi.fn(),
  searchSectionsForGlobalMock: vi.fn(),
  searchTeachersForGlobalMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
  cachedCatalogRuntimeDataMock: vi.fn(),
}));

vi.mock("@/features/search/server/global-search-catalog-queries", () => ({
  searchCoursesForGlobal: searchCoursesForGlobalMock,
  searchSectionsForGlobal: searchSectionsForGlobalMock,
  searchTeachersForGlobal: searchTeachersForGlobalMock,
}));

vi.mock("@/lib/catalog-runtime-cache", () => ({
  cachedCatalogRuntimeData: cachedCatalogRuntimeDataMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

import {
  hasGlobalSearchQuery,
  searchGlobally,
} from "@/features/search/server/global-search-service";

const ORIGIN = "https://life.example";

describe("global search service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchCoursesForGlobalMock.mockResolvedValue([]);
    searchSectionsForGlobalMock.mockResolvedValue([]);
    searchTeachersForGlobalMock.mockResolvedValue([]);
    cachedCatalogRuntimeDataMock.mockImplementation(
      async (
        _namespace: string,
        _cacheKey: string,
        _origin: string,
        load: () => Promise<unknown>,
      ) => load(),
    );
    withUserDbContextMock.mockImplementation(
      async (_userId: string, work: (tx: unknown) => Promise<unknown>) =>
        work({
          homework: { findMany: vi.fn().mockResolvedValue([]) },
          todo: { findMany: vi.fn().mockResolvedValue([]) },
        }),
    );
  });

  it("returns empty groups for short queries", async () => {
    const result = await searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "a",
    });

    expect(result.groups).toEqual([]);
    expect(cachedCatalogRuntimeDataMock).not.toHaveBeenCalled();
  });

  it("searches catalog entities through the runtime cache", async () => {
    searchCoursesForGlobalMock.mockResolvedValue([
      {
        jwId: 101,
        code: "CS101",
        nameCn: "数据结构",
        namePrimary: "数据结构",
      },
    ]);

    const result = await searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "数据",
    });

    expect(cachedCatalogRuntimeDataMock).toHaveBeenCalledWith(
      "search:catalog:zh-cn",
      "5:数据",
      ORIGIN,
      expect.any(Function),
      { ttlMs: 300_000 },
    );
    expect(searchCoursesForGlobalMock).toHaveBeenCalledWith("数据", "zh-cn", 5);
    expect(result.groups).toEqual([
      {
        type: "courses",
        items: [
          {
            id: "course:101",
            title: "数据结构",
            description: "CS101",
            href: "/catalog/courses/101",
          },
        ],
      },
    ]);
  });

  it("includes workspace groups for signed-in users after catalog search", async () => {
    const homeworkFindMany = vi.fn().mockResolvedValue([
      {
        id: "hw-1",
        title: "Lab 1",
        section: {
          jwId: 42,
          course: { nameCn: "操作系统", nameEn: "Operating Systems" },
        },
      },
    ]);
    const todoFindMany = vi.fn().mockResolvedValue([
      {
        id: "todo-1",
        title: "Buy textbook",
        dueAt: new Date("2026-08-01T00:00:00.000Z"),
        completed: false,
      },
    ]);
    withUserDbContextMock.mockImplementation(
      async (_userId: string, work: (tx: unknown) => Promise<unknown>) =>
        work({
          homework: { findMany: homeworkFindMany },
          todo: { findMany: todoFindMany },
        }),
    );

    const result = await searchGlobally({
      locale: "en-us",
      origin: ORIGIN,
      query: "lab",
      userId: "user-1",
    });

    expect(cachedCatalogRuntimeDataMock).toHaveBeenCalledTimes(1);
    expect(homeworkFindMany).toHaveBeenCalled();
    expect(todoFindMany).toHaveBeenCalled();
    expect(result.groups.map((group) => group.type)).toEqual([
      "homeworks",
      "todos",
    ]);
    expect(result.groups[0]?.items[0]?.href).toContain("homeworkId=hw-1");
  });

  it("returns catalog results when workspace search fails", async () => {
    searchCoursesForGlobalMock.mockResolvedValue([
      {
        jwId: 101,
        code: "CS101",
        nameCn: "数据结构",
        namePrimary: "数据结构",
      },
    ]);
    withUserDbContextMock.mockRejectedValue(new Error("pool exhausted"));

    const result = await searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "数据",
      userId: "user-1",
    });

    expect(result.groups).toEqual([
      {
        type: "courses",
        items: [
          {
            id: "course:101",
            title: "数据结构",
            description: "CS101",
            href: "/catalog/courses/101",
          },
        ],
      },
    ]);
  });

  it("reuses cached catalog results without hitting catalog queries again", async () => {
    cachedCatalogRuntimeDataMock.mockResolvedValue([
      {
        type: "courses",
        items: [
          {
            id: "course:101",
            title: "数据结构",
            description: "CS101",
            href: "/catalog/courses/101",
          },
        ],
      },
    ]);

    const result = await searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "数据",
      userId: "user-1",
    });

    expect(result.groups).toHaveLength(1);
    expect(searchCoursesForGlobalMock).not.toHaveBeenCalled();
  });

  it("detects minimum query length", () => {
    expect(hasGlobalSearchQuery("a")).toBe(false);
    expect(hasGlobalSearchQuery("ab")).toBe(true);
  });
});
