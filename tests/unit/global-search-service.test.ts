import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  searchCoursesForGlobalMock,
  searchSectionsForGlobalMock,
  searchTeachersForGlobalMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  searchCoursesForGlobalMock: vi.fn(),
  searchSectionsForGlobalMock: vi.fn(),
  searchTeachersForGlobalMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/features/search/server/global-search-catalog-queries", () => ({
  searchCoursesForGlobal: searchCoursesForGlobalMock,
  searchSectionsForGlobal: searchSectionsForGlobalMock,
  searchTeachersForGlobal: searchTeachersForGlobalMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

import { resetGlobalSearchCacheForTest } from "@/features/search/server/global-search-response-cache";
import {
  hasGlobalSearchQuery,
  searchGlobally,
} from "@/features/search/server/global-search-service";

describe("global search service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGlobalSearchCacheForTest();
    searchCoursesForGlobalMock.mockResolvedValue([]);
    searchSectionsForGlobalMock.mockResolvedValue([]);
    searchTeachersForGlobalMock.mockResolvedValue([]);
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
      query: "a",
    });

    expect(result.groups).toEqual([]);
    expect(searchCoursesForGlobalMock).not.toHaveBeenCalled();
  });

  it("searches catalog entities for public users", async () => {
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
      query: "数据",
    });

    expect(searchCoursesForGlobalMock).toHaveBeenCalledWith("数据", "zh-cn", 5);
    expect(searchSectionsForGlobalMock).toHaveBeenCalledWith(
      "数据",
      "zh-cn",
      5,
    );
    expect(searchTeachersForGlobalMock).toHaveBeenCalledWith(
      "数据",
      "zh-cn",
      5,
    );
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

  it("serves repeated queries from the response cache", async () => {
    searchCoursesForGlobalMock.mockResolvedValue([
      {
        jwId: 101,
        code: "CS101",
        nameCn: "数据结构",
        namePrimary: "数据结构",
      },
    ]);

    await searchGlobally({ locale: "zh-cn", query: "数据" });
    await searchGlobally({ locale: "zh-cn", query: "数据" });

    expect(searchCoursesForGlobalMock).toHaveBeenCalledTimes(1);
  });

  it("includes workspace groups for signed-in users", async () => {
    const homeworkFindMany = vi.fn().mockResolvedValue([
      {
        id: "hw-1",
        title: "Lab 1",
        section: {
          jwId: 42,
          course: { nameCn: "操作系统", namePrimary: "操作系统" },
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
      query: "lab",
      userId: "user-1",
    });

    expect(homeworkFindMany).toHaveBeenCalled();
    expect(todoFindMany).toHaveBeenCalled();
    expect(result.groups.map((group) => group.type)).toEqual([
      "homeworks",
      "todos",
    ]);
    expect(result.groups[0]?.items[0]?.href).toContain("homeworkId=hw-1");
  });

  it("detects minimum query length", () => {
    expect(hasGlobalSearchQuery("a")).toBe(false);
    expect(hasGlobalSearchQuery("ab")).toBe(true);
  });
});
