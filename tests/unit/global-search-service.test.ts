import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listCourseSummariesMock,
  listSectionSummariesMock,
  listTeacherSummariesMock,
  withUserDbContextMock,
} = vi.hoisted(() => ({
  listCourseSummariesMock: vi.fn(),
  listSectionSummariesMock: vi.fn(),
  listTeacherSummariesMock: vi.fn(),
  withUserDbContextMock: vi.fn(),
}));

vi.mock("@/features/catalog/server/course-section-queries", () => ({
  listCourseSummaries: listCourseSummariesMock,
  listSectionSummaries: listSectionSummariesMock,
  listTeacherSummaries: listTeacherSummariesMock,
}));

vi.mock("@/lib/db/prisma", () => ({
  withUserDbContext: withUserDbContextMock,
}));

import {
  hasGlobalSearchQuery,
  searchGlobally,
} from "@/features/search/server/global-search-service";

describe("global search service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCourseSummariesMock.mockResolvedValue({ data: [] });
    listSectionSummariesMock.mockResolvedValue({ data: [] });
    listTeacherSummariesMock.mockResolvedValue({ data: [] });
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
    expect(listCourseSummariesMock).not.toHaveBeenCalled();
  });

  it("searches catalog entities for public users", async () => {
    listCourseSummariesMock.mockResolvedValue({
      data: [
        {
          jwId: 101,
          code: "CS101",
          nameCn: "数据结构",
          namePrimary: "数据结构",
        },
      ],
    });

    const result = await searchGlobally({
      locale: "zh-cn",
      query: "数据",
    });

    expect(listCourseSummariesMock).toHaveBeenCalledWith({
      filters: { search: "数据" },
      locale: "zh-cn",
      pagination: { page: 1, pageSize: 5 },
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
