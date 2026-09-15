import { beforeEach, describe, expect, it, vi } from "vitest";

const { courseFindManyMock, getPrismaMock, sectionFindManyMock } = vi.hoisted(
  () => ({
    courseFindManyMock: vi.fn(),
    getPrismaMock: vi.fn(),
    sectionFindManyMock: vi.fn(),
  }),
);

vi.mock("@/lib/db/prisma", () => ({
  getPrisma: getPrismaMock,
}));

import {
  searchCoursesForGlobal,
  searchSectionsForGlobal,
} from "@/features/search/server/global-search-catalog-queries";

function contains(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

function sectionTerm(value: string) {
  return {
    OR: [
      { course: { nameCn: contains(value) } },
      { course: { nameEn: contains(value) } },
      { course: { code: contains(value) } },
      { code: contains(value) },
      {
        teachers: {
          some: {
            OR: [
              { nameCn: contains(value) },
              { nameEn: contains(value) },
              { code: contains(value) },
            ],
          },
        },
      },
    ],
  };
}

describe("global catalog search queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    courseFindManyMock.mockResolvedValue([]);
    sectionFindManyMock.mockResolvedValue([]);
    getPrismaMock.mockReturnValue({
      course: { findMany: courseFindManyMock },
      section: { findMany: sectionFindManyMock },
    });
  });

  it("matches every whitespace-delimited course term", async () => {
    await searchCoursesForGlobal("  数学   分析  ", "zh-cn", 5);

    expect(courseFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              OR: [
                { nameCn: contains("数学") },
                { nameEn: contains("数学") },
                { code: contains("数学") },
              ],
            },
            {
              OR: [
                { nameCn: contains("分析") },
                { nameEn: contains("分析") },
                { code: contains("分析") },
              ],
            },
          ],
        },
      }),
    );
  });

  it("matches section terms across course and teacher fields", async () => {
    await searchSectionsForGlobal("数学分析 程艺", "zh-cn", 5);

    expect(sectionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          retiredAt: null,
          AND: [sectionTerm("数学分析"), sectionTerm("程艺")],
        },
      }),
    );
  });
});
