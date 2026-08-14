import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  searchCoursesForGlobalMock,
  searchSectionsForGlobalMock,
  searchTeachersForGlobalMock,
  searchLinksForGlobalMock,
  withUserDbContextMock,
  cachedCatalogRuntimeDataMock,
  runCloudflareTraceSpanMock,
} = vi.hoisted(() => ({
  searchCoursesForGlobalMock: vi.fn(),
  searchSectionsForGlobalMock: vi.fn(),
  searchTeachersForGlobalMock: vi.fn(),
  searchLinksForGlobalMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
  cachedCatalogRuntimeDataMock: vi.fn(),
  runCloudflareTraceSpanMock: vi.fn(),
}));

vi.mock("@/lib/adapters/cloudflare-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/adapters/cloudflare-runtime")>();
  return {
    ...actual,
    runCloudflareTraceSpan: runCloudflareTraceSpanMock,
  };
});

vi.mock("@/features/search/server/global-search-catalog-queries", () => ({
  searchCoursesForGlobal: searchCoursesForGlobalMock,
  searchSectionsForGlobal: searchSectionsForGlobalMock,
  searchTeachersForGlobal: searchTeachersForGlobalMock,
}));

vi.mock("@/features/search/server/global-search-link-queries", () => ({
  searchLinksForGlobal: searchLinksForGlobalMock,
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
import type { GlobalSearchResultGroup } from "@/features/search/server/global-search-types";

const ORIGIN = "https://life.example";

describe("global search service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchCoursesForGlobalMock.mockResolvedValue([]);
    searchSectionsForGlobalMock.mockResolvedValue([]);
    searchTeachersForGlobalMock.mockResolvedValue([]);
    searchLinksForGlobalMock.mockReturnValue([]);
    runCloudflareTraceSpanMock.mockImplementation(
      (_name: string, _attributes: object, callback: () => unknown) =>
        callback(),
    );
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
      "search:catalog:v3:zh-cn",
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
    expect(result.groups[0]?.items[0]?.href).toContain("#homework");
    expect(result.groups[0]?.items[0]?.href).not.toContain("tab=homework");
    expect(
      runCloudflareTraceSpanMock.mock.calls.map(([name, attributes]) => [
        name,
        attributes,
      ]),
    ).toEqual([
      ["search.catalog", { "search.scope": "catalog" }],
      ["search.workspace", { "search.scope": "workspace" }],
      ["search.workspace.homeworks", { "search.scope": "workspace" }],
      ["search.workspace.todos", { "search.scope": "workspace" }],
    ]);
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

  it("preserves the optional workspace fallback when a traced DB leg fails", async () => {
    const spanOutcomes: Array<[string, "error" | "success"]> = [];
    runCloudflareTraceSpanMock.mockImplementation(
      (name: string, _attributes: object, callback: () => unknown) => {
        try {
          return Promise.resolve(callback()).then(
            (value) => {
              spanOutcomes.push([name, "success"]);
              return value;
            },
            (error) => {
              spanOutcomes.push([name, "error"]);
              throw error;
            },
          );
        } catch (error) {
          spanOutcomes.push([name, "error"]);
          throw error;
        }
      },
    );
    const homeworkFindMany = vi
      .fn()
      .mockRejectedValue(new Error("homework search failed"));
    withUserDbContextMock.mockImplementation(
      async (_userId: string, work: (tx: unknown) => Promise<unknown>) =>
        work({
          homework: { findMany: homeworkFindMany },
          todo: { findMany: vi.fn().mockResolvedValue([]) },
        }),
    );

    const result = await searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "数据",
      userId: "user-1",
    });

    expect(result).toEqual({ query: "数据", groups: [] });
    expect(spanOutcomes).toEqual(
      expect.arrayContaining([
        ["search.catalog", "success"],
        ["search.workspace.homeworks", "error"],
        ["search.workspace", "error"],
      ]),
    );
    expect(
      runCloudflareTraceSpanMock.mock.calls.map(([name, attributes]) => [
        name,
        attributes,
      ]),
    ).toEqual([
      ["search.catalog", { "search.scope": "catalog" }],
      ["search.workspace", { "search.scope": "workspace" }],
      ["search.workspace.homeworks", { "search.scope": "workspace" }],
    ]);
  });

  it("starts workspace search without waiting for the catalog cache", async () => {
    let resolveCatalog:
      | ((groups: GlobalSearchResultGroup[]) => void)
      | undefined;
    cachedCatalogRuntimeDataMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCatalog = resolve;
      }),
    );

    const resultPromise = searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "数据",
      userId: "user-1",
    });
    await Promise.resolve();

    expect(withUserDbContextMock).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
    );

    resolveCatalog?.([]);
    await expect(resultPromise).resolves.toEqual({ query: "数据", groups: [] });
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

  it("refreshes source-backed links when database catalog results are cached", async () => {
    let cachedGroups: GlobalSearchResultGroup[] | undefined;
    cachedCatalogRuntimeDataMock.mockImplementation(
      async (
        _namespace: string,
        _cacheKey: string,
        _origin: string,
        load: () => Promise<GlobalSearchResultGroup[]>,
      ) => {
        cachedGroups ??= await load();
        return cachedGroups;
      },
    );
    searchLinksForGlobalMock.mockReturnValue([
      {
        slug: "mail",
        title: "Old mail title",
        description: "Old mail description",
        url: "https://old.example/",
      },
    ]);

    const first = await searchGlobally({
      locale: "en-us",
      origin: ORIGIN,
      query: "mail",
    });
    searchLinksForGlobalMock.mockReturnValue([
      {
        slug: "mail",
        title: "New mail title",
        description: "New mail description",
        url: "https://new.example/",
      },
    ]);
    const second = await searchGlobally({
      locale: "en-us",
      origin: ORIGIN,
      query: "mail",
    });

    expect(searchCoursesForGlobalMock).toHaveBeenCalledTimes(1);
    expect(searchLinksForGlobalMock).toHaveBeenCalledTimes(2);
    expect(first.groups[0]?.items[0]?.href).toBe("https://old.example/");
    expect(second.groups[0]?.items[0]?.href).toBe("https://new.example/");
  });

  it("includes link matches in catalog results", async () => {
    searchLinksForGlobalMock.mockReturnValue([
      {
        slug: "mail",
        title: "邮箱",
        description: "USTC 邮件系统。",
        url: "https://mail.ustc.edu.cn/",
      },
    ]);

    const result = await searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "邮箱",
    });

    expect(result.groups).toEqual([
      {
        type: "links",
        items: [
          {
            id: "link:mail",
            title: "邮箱",
            description: "USTC 邮件系统。",
            href: "https://mail.ustc.edu.cn/",
            external: true,
          },
        ],
      },
    ]);
  });

  it("orders sections before teachers and courses in catalog results", async () => {
    searchTeachersForGlobalMock.mockResolvedValue([
      { id: 1, nameCn: "程艺", code: "T001", department: null },
    ]);
    searchSectionsForGlobalMock.mockResolvedValue([
      {
        jwId: 42,
        code: "001",
        campus: { nameCn: "东区", namePrimary: "东区" },
        course: {
          code: "CS101",
          nameCn: "数据结构",
          namePrimary: "数据结构",
        },
        semester: { nameCn: "2026 春" },
        teachers: [{ nameCn: "程艺", namePrimary: "程艺" }],
      },
    ]);
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
      query: "程艺",
    });

    expect(result.groups.map((group) => group.type)).toEqual([
      "sections",
      "teachers",
      "courses",
    ]);
    expect(result.groups[0]?.items[0]).toEqual({
      id: "section:42",
      title: "数据结构 · 程艺",
      description: "2026 春 · 东区 · 001",
      href: "/catalog/sections/42",
    });
  });

  it("falls back section titles to course · code when teachers are empty", async () => {
    searchSectionsForGlobalMock.mockResolvedValue([
      {
        jwId: 7,
        code: "02",
        campus: null,
        course: {
          code: "MA101",
          nameCn: "数学分析",
          namePrimary: "数学分析",
        },
        semester: { nameCn: "2026 秋" },
        teachers: [],
      },
    ]);

    const result = await searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "数学分析",
    });

    expect(result.groups[0]?.items[0]).toEqual({
      id: "section:7",
      title: "数学分析 · 02",
      description: "2026 秋 · 02",
      href: "/catalog/sections/7",
    });
  });

  it("detects minimum query length", () => {
    expect(hasGlobalSearchQuery("a")).toBe(false);
    expect(hasGlobalSearchQuery("ab")).toBe(true);
  });
});
