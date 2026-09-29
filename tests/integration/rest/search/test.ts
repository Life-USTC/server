import { expect } from "@playwright/test";
import type { GlobalSearchResponse } from "@/features/search/server/global-search-types";
import { createDeferred } from "../../../shared/deferred";
import { test } from "./_fixture";

const search = (query: string, locale = "zh-cn", scope = "catalog") =>
  `/api/search?${new URLSearchParams({ q: query, locale, scope })}`;

test.describe("GET /api/search", () => {
  test("accepts the catalog search bound and rejects longer queries", async ({
    request,
    run,
  }) =>
    run(async () => {
      const accepted = await request.get(
        `/api/search?q=${"a".repeat(200)}&locale=zh-cn`,
      );
      expect(accepted.status()).toBe(200);

      const rejected = await request.get(
        `/api/search?q=${"a".repeat(201)}&locale=zh-cn`,
      );
      expect(rejected.status()).toBe(400);
      await expect(rejected.json()).resolves.toEqual({
        error: "Search query must not exceed 200 characters",
      });
    }));
});

test("returns catalog matches for Chinese queries", async ({
  request,
  catalog,
  run,
}) =>
  run(async () => {
    const response = await request.get(search("线性代数"));
    expect(response.status()).toBe(200);
    const result: GlobalSearchResponse = await response.json();
    expect(
      result.groups.find((group) => group.type === "courses")?.items,
    ).toEqual([
      {
        id: `course:${catalog.linearAlgebra.jwId}`,
        title: "线性代数",
        description: "SEARCH-LINEAR",
        href: `/catalog/courses/${catalog.linearAlgebra.jwId}`,
      },
    ]);
  }));

test("matches section terms across course and teacher fields", async ({
  request,
  catalog,
  run,
}) =>
  run(async () => {
    const response = await request.get(search("数学分析 程艺"));
    expect(response.status()).toBe(200);
    const result: GlobalSearchResponse = await response.json();
    expect(
      result.groups.find((group) => group.type === "sections")?.items,
    ).toEqual([
      expect.objectContaining({
        id: `section:${catalog.analysisSection.jwId}`,
        title: "数学分析 · 程艺",
        href: `/catalog/sections/${catalog.analysisSection.jwId}`,
      }),
    ]);
    expect(result.groups.some((group) => group.type === "courses")).toBe(false);
  }));

test("returns catalog results for signed-in users and can include workspace groups", async ({
  request,
  catalog,
  isolatedWorker,
  run,
}) =>
  run(async () => {
    const owner = await isolatedWorker.createActor();
    const other = await isolatedWorker.createActor();
    const db = isolatedWorker.database.owner;
    const { homework, todo, otherTodo } = await db.$transaction(async (tx) => {
      await tx.userSectionSubscription.create({
        data: {
          userId: owner.id,
          sectionId: catalog.linearAlgebra.sections[0].id,
        },
      });
      const homework = await tx.homework.create({
        data: {
          title: "线性代数作业",
          sectionId: catalog.linearAlgebra.sections[0].id,
          createdById: owner.id,
        },
      });
      const todo = await tx.todo.create({
        data: { title: "线性代数复习", userId: owner.id },
      });
      const otherTodo = await tx.todo.create({
        data: { title: "线性代数其他人的待办", userId: other.id },
      });
      return { homework, todo, otherTodo };
    });
    const publicResponse = await owner.request.get(search("线性代数"));
    expect(publicResponse.status()).toBe(200);
    const publicResult: GlobalSearchResponse = await publicResponse.json();
    expect(publicResult.groups.some((group) => group.type === "courses")).toBe(
      true,
    );
    expect(
      publicResult.groups.filter(
        (group) => group.type === "homeworks" || group.type === "todos",
      ),
    ).toEqual([]);

    const privateResponse = await owner.request.get(
      search("线性代数", "zh-cn", "workspace"),
    );
    expect(privateResponse.status()).toBe(200);
    const privateResult: GlobalSearchResponse = await privateResponse.json();
    expect(
      privateResult.groups
        .find((group) => group.type === "homeworks")
        ?.items.map((item) => item.id),
    ).toEqual([`homework:${homework.id}`]);
    expect(
      privateResult.groups
        .find((group) => group.type === "todos")
        ?.items.map((item) => item.id),
    ).toEqual([`todo:${todo.id}`]);
    expect(
      privateResult.groups
        .flatMap((group) => group.items)
        .map((item) => item.id),
    ).not.toContain(`todo:${otherTodo.id}`);
    const anonymousResponse = await request.get(
      search("线性代数", "zh-cn", "workspace"),
    );
    expect(anonymousResponse.status()).toBe(200);
    const anonymousResult: GlobalSearchResponse =
      await anonymousResponse.json();
    expect(anonymousResult.groups).toEqual(publicResult.groups);
  }));

test("reuses the catalog runtime cache across repeated searches", async ({
  request,
  catalog,
  isolatedWorker,
  run,
}) =>
  run(async () => {
    const response = await request.get(search("线性代数"));
    expect(response.status()).toBe(200);
    const first: GlobalSearchResponse = await response.json();
    expect(
      first.groups
        .find((group) => group.type === "courses")
        ?.items.map((item) => item.id),
    ).toEqual([`course:${catalog.linearAlgebra.jwId}`]);

    const acquired = createDeferred<void>();
    const release = createDeferred<void>();
    const db = isolatedWorker.database.owner;
    const lock = db.$transaction(async (tx) => {
      await tx.$executeRaw`LOCK TABLE "Course" IN ACCESS EXCLUSIVE MODE`;
      acquired.resolve();
      await release.promise;
    });
    try {
      await Promise.race([acquired.promise, lock]);
      expect(
        await db.$queryRaw`SELECT mode FROM pg_locks WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database()) AND relation = '"Course"'::regclass AND mode = 'AccessExclusiveLock' AND granted`,
      ).toEqual([{ mode: "AccessExclusiveLock" }]);
      // A cache miss would block on the real table lock. Keep it held until the
      // complete HTTP response arrives, rather than replacing the query function.
      const cachedResponse = await request.get(search("线性代数"), {
        timeout: 10_000,
      });
      expect(cachedResponse.status()).toBe(200);
      const second: GlobalSearchResponse = await cachedResponse.json();
      expect(second.groups).toEqual(first.groups);
    } finally {
      release.resolve();
      await lock;
    }
  }));

test("keeps runtime search results isolated by locale", async ({
  request,
  catalog,
  run,
}) =>
  run(async () => {
    const chineseResponse = await request.get(search("线性代数", "zh-cn"));
    expect(chineseResponse.status()).toBe(200);
    const chinese: GlobalSearchResponse = await chineseResponse.json();
    expect(
      chinese.groups.find((group) => group.type === "courses")?.items,
    ).toEqual([
      expect.objectContaining({
        id: `course:${catalog.linearAlgebra.jwId}`,
        title: "线性代数",
      }),
    ]);
    const englishResponse = await request.get(search("线性代数", "en-us"));
    expect(englishResponse.status()).toBe(200);
    const english: GlobalSearchResponse = await englishResponse.json();
    expect(
      english.groups.find((group) => group.type === "courses")?.items,
    ).toEqual([
      expect.objectContaining({
        id: `course:${catalog.linearAlgebra.jwId}`,
        title: "Linear Algebra",
      }),
    ]);
  }));
