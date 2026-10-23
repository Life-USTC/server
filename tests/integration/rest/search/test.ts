import { expect } from "@playwright/test";
import type { GlobalSearchResponse } from "@/features/search/server/global-search-types";
import { createDeferred } from "../../../shared/deferred";
import { test } from "./_fixture";

const search = (query: string, locale = "zh-cn", scope = "catalog") =>
  `/api/search?${new URLSearchParams({ q: query, locale, scope })}`;

test.describe("GET /api/search", () => {
  test(
    "accepts the catalog search bound and rejects longer queries",
    { tag: "@Search/REST" },
    async ({ request, run }) =>
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
      }),
  );
});

test(
  "returns catalog matches for Chinese queries",
  { tag: "@Search/REST" },
  async ({ request, catalog, run }) =>
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
    }),
);

test(
  "matches section terms across course and teacher fields",
  { tag: "@Search/REST" },
  async ({ request, catalog, run }) =>
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
      expect(result.groups.some((group) => group.type === "courses")).toBe(
        false,
      );
    }),
);

test(
  "preserves section matches, ordering and limits across course fields",
  { tag: "@Search/REST" },
  async ({ request, isolatedWorker, run }) =>
    run(async () => {
      await isolatedWorker.database.owner.$transaction(async (tx) => {
        const current = await tx.semester.create({
          data: { jwId: 202601, code: "CURRENT", nameCn: "2026年秋季学期" },
        });
        const previous = await tx.semester.create({
          data: { jwId: 202501, code: "PREVIOUS", nameCn: "2025年秋季学期" },
        });
        const chinese = await tx.course.create({
          data: { jwId: 3101, code: "CN-COURSE", nameCn: "NEEDLE 中文" },
        });
        const english = await tx.course.create({
          data: {
            jwId: 3102,
            code: "EN-COURSE",
            nameCn: "英文课程",
            nameEn: "Needle English",
          },
        });
        const code = await tx.course.create({
          data: { jwId: 3103, code: "NEEDLE-CODE", nameCn: "代码课程" },
        });
        const other = await tx.course.create({
          data: { jwId: 3104, code: "OTHER-COURSE", nameCn: "其他课程" },
        });
        await tx.section.createMany({
          data: [
            { jwId: 3303, courseId: chinese.id },
            { jwId: 3301, courseId: english.id },
            { jwId: 3302, courseId: code.id },
            { jwId: 3304, courseId: other.id, code: "NEEDLE-SECTION" },
            { jwId: 3290, courseId: chinese.id, semesterId: previous.id },
            {
              jwId: 3291,
              courseId: chinese.id,
              retiredAt: new Date("2026-01-01T00:00:00Z"),
            },
            { jwId: 3281, courseId: chinese.id },
            { jwId: 3282, courseId: other.id },
          ].map((section) => ({
            code: `SECTION-${section.jwId}`,
            semesterId: current.id,
            ...section,
          })),
        });
        await tx.teacher.create({
          data: {
            jwId: 3201,
            code: "MATCH-TEACHER",
            nameCn: "授课教师",
            sections: {
              connect: [3301, 3302, 3303, 3304, 3290, 3291, 3282].map(
                (jwId) => ({ jwId }),
              ),
            },
          },
        });
      });

      const response = await request.get(
        `${search("nEeDlE TEACHER")}&limit=25`,
      );
      expect(response.status()).toBe(200);
      const result: GlobalSearchResponse = await response.json();
      expect(
        result.groups
          .find((group) => group.type === "sections")
          ?.items.map((item) => item.id),
      ).toEqual([
        "section:3301",
        "section:3302",
        "section:3303",
        "section:3304",
        "section:3290",
      ]);

      const limitedResponse = await request.get(
        `${search("nEeDlE TEACHER")}&limit=2`,
      );
      expect(limitedResponse.status()).toBe(200);
      const limited: GlobalSearchResponse = await limitedResponse.json();
      expect(
        limited.groups
          .find((group) => group.type === "sections")
          ?.items.map((item) => item.id),
      ).toEqual(["section:3301", "section:3302"]);
    }),
);

test(
  "returns catalog results for signed-in users and can include workspace groups",
  { tag: "@Search/REST" },
  async ({ request, catalog, isolatedWorker, run }) =>
    run(async () => {
      const owner = await isolatedWorker.createActor();
      const other = await isolatedWorker.createActor();
      const db = isolatedWorker.database.owner;
      const { homework, todo, otherTodo } = await db.$transaction(
        async (tx) => {
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
        },
      );
      const publicResponse = await owner.request.get(search("线性代数"));
      expect(publicResponse.status()).toBe(200);
      const publicResult: GlobalSearchResponse = await publicResponse.json();
      expect(
        publicResult.groups.some((group) => group.type === "courses"),
      ).toBe(true);
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
    }),
);

test(
  "reuses the catalog runtime cache across repeated searches",
  { tag: "@Search/REST" },
  async ({ request, catalog, isolatedWorker, run }) =>
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
    }),
);

test(
  "keeps runtime search results isolated by locale",
  { tag: "@Search/REST" },
  async ({ request, catalog, run }) =>
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
    }),
);
