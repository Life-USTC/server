import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as catalogQueries from "@/features/search/server/global-search-catalog-queries";
import { searchGlobally } from "@/features/search/server/global-search-service";
import { prisma } from "@/lib/db/prisma";

const ORIGIN = "http://localhost:3000";

function clearPublicRuntimeCache() {
  delete (
    globalThis as typeof globalThis & {
      __lifeUstcPublicRuntimeCache?: unknown;
    }
  ).__lifeUstcPublicRuntimeCache;
}

describe("global search integration", () => {
  let userId = "";
  const marker = crypto.randomUUID();

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `integration-search-${marker}@example.test`,
        name: "Search Integration User",
      },
      select: { id: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: `integration-search-${marker}@example.test` },
    });
  });

  it("returns catalog matches for Chinese queries", async () => {
    clearPublicRuntimeCache();

    const result = await searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "线性代数",
    });

    expect(result.groups.some((group) => group.type === "courses")).toBe(true);
    expect(
      result.groups
        .flatMap((group) => group.items)
        .some((item) => item.title.includes("线性代数")),
    ).toBe(true);
  });

  it("matches section terms across course and teacher fields", async () => {
    clearPublicRuntimeCache();
    const uniqueBase = -1_500_000_000 - Number.parseInt(marker.slice(0, 6), 16);
    const course = await prisma.course.create({
      data: {
        jwId: uniqueBase,
        code: `SEARCH-${marker}`,
        nameCn: "数学分析",
      },
      select: { id: true },
    });
    const teacher = await prisma.teacher.create({
      data: {
        jwId: uniqueBase + 1,
        code: `TEACHER-${marker}`,
        nameCn: "程艺",
      },
      select: { id: true },
    });

    try {
      const section = await prisma.section.create({
        data: {
          jwId: uniqueBase + 2,
          code: "000-SEARCH-INTEGRATION",
          courseId: course.id,
          teachers: { connect: { id: teacher.id } },
        },
        select: { jwId: true },
      });

      const result = await searchGlobally({
        locale: "zh-cn",
        origin: ORIGIN,
        query: "数学分析 程艺",
      });

      expect(
        result.groups
          .find((group) => group.type === "sections")
          ?.items.some((item) => item.id === `section:${section.jwId}`),
      ).toBe(true);
    } finally {
      await prisma.section.deleteMany({ where: { courseId: course.id } });
      await prisma.teacher.deleteMany({ where: { id: teacher.id } });
      await prisma.course.deleteMany({ where: { id: course.id } });
    }
  });

  it("returns catalog results for signed-in users and can include workspace groups", async () => {
    clearPublicRuntimeCache();

    const subscribedUser = await prisma.user.findFirst({
      where: {
        sectionSubscriptions: { some: {} },
      },
      select: { id: true },
    });
    expect(subscribedUser?.id).toBeTruthy();

    const result = await searchGlobally({
      locale: "zh-cn",
      origin: ORIGIN,
      query: "线性代数",
      userId: subscribedUser?.id,
    });

    expect(result.groups.some((group) => group.type === "courses")).toBe(true);
  });

  it("reuses the catalog runtime cache across repeated searches", async () => {
    clearPublicRuntimeCache();
    const courseSearchSpy = vi.spyOn(catalogQueries, "searchCoursesForGlobal");

    try {
      const first = await searchGlobally({
        locale: "zh-cn",
        origin: ORIGIN,
        query: "线性代数",
        userId,
      });
      const callsAfterFirst = courseSearchSpy.mock.calls.length;

      const second = await searchGlobally({
        locale: "zh-cn",
        origin: ORIGIN,
        query: "线性代数",
        userId,
      });

      expect(first.groups).toEqual(second.groups);
      expect(callsAfterFirst).toBeGreaterThan(0);
      expect(courseSearchSpy.mock.calls.length).toBe(callsAfterFirst);
    } finally {
      courseSearchSpy.mockRestore();
    }
  });

  it("keeps runtime search results isolated by locale", async () => {
    clearPublicRuntimeCache();
    const courseSearchSpy = vi.spyOn(catalogQueries, "searchCoursesForGlobal");

    try {
      await searchGlobally({
        locale: "zh-cn",
        origin: ORIGIN,
        query: "线性代数",
      });
      const callsAfterChinese = courseSearchSpy.mock.calls.length;

      await searchGlobally({
        locale: "en-us",
        origin: ORIGIN,
        query: "线性代数",
      });

      expect(callsAfterChinese).toBeGreaterThan(0);
      expect(courseSearchSpy.mock.calls.length).toBeGreaterThan(
        callsAfterChinese,
      );
    } finally {
      courseSearchSpy.mockRestore();
    }
  });
});
