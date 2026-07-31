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
});
