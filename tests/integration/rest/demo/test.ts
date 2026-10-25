import { type APIRequestContext, expect } from "@playwright/test";
import { sectionDetailSchema } from "../../../../src/lib/api/schemas/academic-section-detail-response-schemas";
import { commentsListResponseSchema } from "../../../../src/lib/api/schemas/comments-response-schemas";
import {
  homeworkDetailResponseSchema,
  homeworksListResponseSchema,
  subscribedHomeworksResponseSchema,
} from "../../../../src/lib/api/schemas/homeworks-response-schemas";
import {
  currentCalendarSubscriptionResponseSchema,
  todosListResponseSchema,
} from "../../../../src/lib/api/schemas/misc-response-schema-core";
import { descriptionsResponseSchema } from "../../../../src/lib/api/schemas/response-schemas";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

const secret = { "x-test-storage-secret": "local-test-storage-observer" };
const cookieHeader = (cookie: { name: string; value: string }) =>
  `${cookie.name}=${cookie.value}`;

async function databaseSnapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const result: Record<string, unknown[]> = {};
  for (const { tablename } of tables) {
    const name = tablename.replaceAll('"', '""');
    result[tablename] = await db.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM "${name}" t ORDER BY row_to_json(t)::text`,
    );
  }
  return result;
}

async function enter(
  request: APIRequestContext,
  origin: string,
  headers: Record<string, string> = {},
) {
  const response = await request.post("/account/demo/enter", {
    headers: { ...headers, origin },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(303);
  expect(response.headers().location).toBe("/workspace/todos");
  expect(response.headers()["set-cookie"]).toMatch(
    /life-ustc\.demo=.*HttpOnly/,
  );
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  await response.body();
  const cookie = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "life-ustc.demo",
  );
  expect(cookie).toBeDefined();
  if (!cookie) throw new Error("Demo entry did not set its cookie");
  return cookie;
}

test("demo production entry stays disabled without the explicit binding", {
  tag: "@Account/REST",
}, async ({ request, isolatedWorker, run }) => {
  await run(async () => {
    const before = await databaseSnapshot(isolatedWorker);
    const signIn = await request.get("/account/sign-in");
    expect(await signIn.text()).toContain(
      "https://www.googletagmanager.com/gtag/js?id=G-JNK35J2Q3R",
    );
    for (const path of [
      "/account/demo/enter",
      "/account/%64emo/enter",
      "/account/demo/%65nter",
    ]) {
      const response = await request.post(path, {
        headers: { origin: isolatedWorker.origin },
        maxRedirects: 0,
      });
      expect(response.status()).toBe(404);
      expect(response.headers()["set-cookie"]).toBeUndefined();
      await response.body();
    }
    expect(await databaseSnapshot(isolatedWorker)).toEqual(before);
  });
});

test.describe("enabled demo", () => {
  test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

  test("demo entry is explicit, same-origin and separate from real sessions", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const before = await databaseSnapshot(isolatedWorker);
      for (const headers of [
        {},
        { origin: "https://untrusted.test" },
        { origin: isolatedWorker.origin, cookie: cookieHeader(actor.cookie) },
      ] as Record<string, string>[]) {
        const response = await request.post("/account/demo/enter", {
          headers,
          maxRedirects: 0,
        });
        expect(response.status()).toBe(403);
        expect(response.headers()["set-cookie"]).toBeUndefined();
        await response.body();
      }
      for (const path of ["/account/%64emo/enter", "/account/demo/%65nter"]) {
        const response = await request.post(path, { maxRedirects: 0 });
        expect(response.status()).toBe(404);
        expect(response.headers()["set-cookie"]).toBeUndefined();
        await response.body();
      }
      const cookie = await enter(request, isolatedWorker.origin);
      const repeat = await request.post("/account/demo/enter", {
        headers: { origin: isolatedWorker.origin },
        maxRedirects: 0,
      });
      expect(repeat.status()).toBe(403);
      await repeat.body();
      const exit = await request.post("/account/demo/exit", {
        headers: {
          origin: isolatedWorker.origin,
          cookie: `${cookieHeader(cookie)}; ${cookieHeader(actor.cookie)}`,
        },
        maxRedirects: 0,
      });
      expect(exit.status()).toBe(303);
      expect(exit.headers().location).toBe("/account/sign-in");
      expect(exit.headers()["set-cookie"]).toMatch(/^life-ustc\.demo=;/);
      expect(exit.headers()["set-cookie"]).not.toContain("better-auth");
      await exit.body();
      expect(await databaseSnapshot(isolatedWorker)).toEqual(before);
      const own = await actor.request.get("/api/workspace/todos");
      expect(own.status()).toBe(200);
      await own.body();
    });
  });

  test("demo homework reads preserve states, pagination and section context", {
    tag: "@Homework/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const cookie = await enter(request, isolatedWorker.origin);
      const headers = { cookie: `${cookieHeader(cookie)}; NEXT_LOCALE=en-us` };
      const workspace = await request.get(
        "/api/workspace/homeworks?page=2&pageSize=2",
        { headers },
      );
      expect(workspace.status()).toBe(200);
      expect(
        subscribedHomeworksResponseSchema.parse(await workspace.json()),
      ).toMatchObject({
        data: [
          {
            id: "demo-homework-matrices",
            completionRequired: true,
            completion: { completedAt: "2026-09-23T16:00:00+08:00" },
          },
          {
            id: "demo-homework-project",
            isMajor: true,
            requiresTeam: true,
            submissionDueAt: null,
          },
        ],
        pagination: { page: 2, pageSize: 2, total: 6 },
      });
      const list = await request.get(
        "/api/community/section-homeworks?sectionId=101&sectionJwId=910001",
        { headers },
      );
      expect(list.status()).toBe(200);
      const body = homeworksListResponseSchema.parse(await list.json());
      expect(body.data.map((homework) => homework.id)).toEqual([
        "demo-homework-determinants",
        "demo-homework-vectors",
        "demo-homework-matrices",
        "demo-homework-project",
      ]);
      expect(body.data[1]).not.toHaveProperty("description");
      expect(body.meta.viewer).toMatchObject({
        userId: null,
        isAuthenticated: false,
      });
      const detail = await request.get(
        "/api/community/section-homeworks/demo-homework-vectors",
        { headers },
      );
      expect(detail.status()).toBe(200);
      const homework = homeworkDetailResponseSchema.parse(
        await detail.json(),
      ).homework;
      expect(homework).toMatchObject({
        id: "demo-homework-vectors",
        title: "Vector spaces exercises",
        completionRequired: true,
        submissionDueAt: "2026-09-25T18:00:00+08:00",
        section: { id: 101, jwId: 910001, course: { jwId: 920001 } },
        description: {
          content:
            "Read the course notes and explain your reasoning for each exercise.",
        },
      });
      const focused = await request.get(
        "/_internal/catalog/sections/910001/viewer?homeworkId=demo-homework-vectors",
        { headers },
      );
      expect(focused.status()).toBe(200);
      expect((await focused.json()).homeworkData.homeworks[1]).toMatchObject({
        id: homework.id,
        description: homework.description,
      });
      for (const [id, sectionId] of [
        ["demo-homework-physics", 102],
        ["demo-homework-structures", 103],
      ] as const) {
        const advisory = await request.get(
          `/api/community/section-homeworks/${id}`,
          { headers },
        );
        expect(
          homeworkDetailResponseSchema.parse(await advisory.json()).homework,
        ).toMatchObject({
          id,
          sectionId,
          completionRequired: false,
          completion: null,
        });
      }
      const head = await request.head(
        "/api/community/section-homeworks/demo-homework-vectors",
        { headers },
      );
      expect(head.status()).toBe(200);
      expect(await head.body()).toHaveLength(0);
      expect(head.headers()["cache-control"]).toBe("private, no-store");
    });
  });

  test("demo subscriptions share fixed page, API and navigation data without a feed", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      await enter(request, isolatedWorker.origin);
      for (const locale of ["en-US", "zh-CN"]) {
        const response = await request.get(
          "/api/workspace/subscriptions/current?userId=unrelated",
          {
            headers: { "accept-language": locale },
          },
        );
        expect(response.status()).toBe(200);
        expect(response.headers()["cache-control"]).toBe("private, no-store");
        const body = currentCalendarSubscriptionResponseSchema.parse(
          await response.json(),
        );
        expect(body.subscription).toMatchObject({
          userId: "demo:workspace-v1",
          calendarPath: null,
          calendarUrl: null,
        });
        expect(
          body.subscription?.sections.map(
            ({ jwId, kind, credits, course, teachers }) => ({
              jwId,
              kind,
              credits,
              name: course.namePrimary,
              teachers: teachers.map(({ namePrimary }) => namePrimary),
            }),
          ),
        ).toEqual(
          locale === "en-US"
            ? [
                {
                  jwId: 910001,
                  kind: "regular",
                  credits: 4,
                  name: "Linear Algebra",
                  teachers: ["Teacher Chen", "Teacher Lin"],
                },
                {
                  jwId: 910002,
                  kind: "auditor",
                  credits: 3,
                  name: "College Physics",
                  teachers: ["Teacher Chen"],
                },
                {
                  jwId: 910003,
                  kind: "teaching_assistant",
                  credits: 3.5,
                  name: "Data Structures",
                  teachers: ["Teacher Lin"],
                },
              ]
            : [
                {
                  jwId: 910001,
                  kind: "regular",
                  credits: 4,
                  name: "线性代数",
                  teachers: ["陈老师", "林老师"],
                },
                {
                  jwId: 910002,
                  kind: "auditor",
                  credits: 3,
                  name: "大学物理",
                  teachers: ["陈老师"],
                },
                {
                  jwId: 910003,
                  kind: "teaching_assistant",
                  credits: 3.5,
                  name: "数据结构",
                  teachers: ["林老师"],
                },
              ],
        );
        const data = await request.get("/workspace/subscriptions/__data.json", {
          headers: { "accept-language": locale },
        });
        expect(data.status()).toBe(200);
        const text = await data.text();
        for (const name of locale === "en-US"
          ? ["Linear Algebra", "College Physics", "Data Structures"]
          : ["线性代数", "大学物理", "数据结构"])
          expect(text).toContain(name);
        expect(data.headers()["x-life-public-navigation"]).toBeUndefined();
      }
      const bootstrap = await request.get("/_internal/shell-bootstrap");
      expect(await bootstrap.json()).toMatchObject({
        viewer: null,
        demo: { fixtureVersion: "workspace-v1" },
        navigation: { subscribedSectionCount: 3, pendingTodosCount: 2 },
      });
      for (const path of [
        "/workspace/subscriptions",
        "/workspace/homeworks",
        "/workspace/subscriptions/__data.json",
        "/api/workspace/subscriptions/current",
      ]) {
        const head = await request.head(path);
        expect(head.status()).toBe(200);
        expect(head.headers()["cache-control"]).toBe("private, no-store");
        expect(await head.body()).toHaveLength(0);
      }
    });
  });

  test("demo API preserves fixed samples, filters, counts and pagination", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      await enter(request, isolatedWorker.origin);
      const response = await request.get("/api/workspace/todos", {
        headers: { "accept-language": "en-US" },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      todosListResponseSchema.parse(body);
      expect(body.counts).toEqual({ incomplete: 2, completed: 1, overdue: 1 });
      expect(
        body.todos.map((todo: { id: string; title: string }) => [
          todo.id,
          todo.title,
        ]),
      ).toEqual([
        ["demo-todo-reading", "Review linear algebra"],
        ["demo-todo-outline", "Organize course notes"],
        ["demo-todo-library", "Return library books"],
      ]);
      const filtered = await request.get(
        "/api/workspace/todos?completed=false&dueAfter=2026-09-24T00:00:00%2B08:00&page=1&pageSize=1",
      );
      expect(filtered.status()).toBe(200);
      const page = await filtered.json();
      todosListResponseSchema.parse(page);
      expect(page.data.map((todo: { id: string }) => todo.id)).toEqual([
        "demo-todo-outline",
      ]);
      expect(page.pagination).toEqual({
        page: 1,
        pageSize: 1,
        total: 1,
        totalPages: 1,
      });
      expect(page.meta.counts).toEqual({
        incomplete: 2,
        completed: 1,
        overdue: 1,
      });
      const empty = await request.get(
        "/api/workspace/todos?completed=true&priority=high",
      );
      expect((await empty.json()).todos).toEqual([]);
      const invalid = await request.get("/api/workspace/todos?pageSize=101");
      expect(invalid.status()).toBe(400);
      await invalid.body();
      const data = await request.get("/workspace/todos/__data.json");
      expect(data.status()).toBe(200);
      expect(await data.text()).toContain("demo-todo-reading");
      expect(data.headers()["x-life-public-navigation"]).toBeUndefined();
    });
  });

  test("demo catalog details share localized samples and existing read schemas", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const cookie = await enter(request, isolatedWorker.origin);
      for (const [locale, courseName, teacherName, description] of [
        ["zh-CN", "线性代数", "陈老师", "这份样例介绍课程内容。"],
        [
          "en-US",
          "Linear Algebra",
          "Teacher Chen",
          "This sample introduces the course topics.",
        ],
      ]) {
        const headers = {
          "accept-language": locale,
          cookie: `${cookieHeader(cookie)}; NEXT_LOCALE=${locale.toLowerCase()}`,
        };
        const response = await request.get(
          `/api/catalog/sections/910001?locale=${locale.toLowerCase()}`,
          {
            headers,
          },
        );
        expect(response.status()).toBe(200);
        const section = sectionDetailSchema.parse(await response.json());
        expect(section).toMatchObject({
          id: 101,
          jwId: 910001,
          course: { id: 201, jwId: 920001, namePrimary: courseName },
        });
        expect(section.teachers).toMatchObject([
          { id: 401, namePrimary: teacherName },
          { id: 402 },
        ]);
        expect(section.schedules).toMatchObject([
          {
            date: "2026-09-24T00:00:00+08:00",
            startTime: "800",
            endTime: "945",
          },
        ]);
        expect(section.exams).toMatchObject([
          {
            examDate: "2027-01-08T00:00:00+08:00",
            startTime: 1400,
            endTime: 1600,
          },
        ]);
        for (const [query, exams, schedules] of [
          ["includeExams=true", 1, 0],
          ["includeSchedules=true", 0, 1],
          ["includeTeacherDepartments=true", 0, 0],
        ] as const) {
          const partial = await request.get(
            `/api/catalog/sections/910001?${query}&locale=${locale.toLowerCase()}`,
            { headers },
          );
          const body = sectionDetailSchema.parse(await partial.json());
          expect(body.exams).toHaveLength(exams);
          expect(body.schedules).toHaveLength(schedules);
          expect(body.teachers).toHaveLength(2);
        }
        for (const [type, id] of [
          ["section", 101],
          ["course", 201],
          ["teacher", 401],
        ] as const) {
          const response = await request.get(
            `/api/community/descriptions?targetType=${type}&targetId=${id}`,
            { headers },
          );
          expect(response.status()).toBe(200);
          const body = descriptionsResponseSchema.parse(await response.json());
          expect(body).toMatchObject({
            description: { id: `demo-description-${type}-${id}` },
            history: [],
            viewer: { userId: null, isAuthenticated: false },
          });
          if (type !== "teacher")
            expect(body.description.content).toContain(description);
        }
        for (const query of [
          "targetType=section&targetId=101",
          "targetType=course&courseJwId=920001",
          "targetType=teacher&teacherId=401",
          "targetType=section-teacher&sectionId=101&teacherId=401",
        ]) {
          const response = await request.get(
            `/api/community/comments?${query}&page=2&pageSize=5`,
            { headers },
          );
          expect(response.status()).toBe(200);
          expect(
            commentsListResponseSchema.parse(await response.json()),
          ).toMatchObject({
            data: [],
            pagination: { page: 2, pageSize: 5, total: 0 },
            meta: {
              hiddenCount: 0,
              viewer: { userId: null, isAuthenticated: false },
            },
          });
        }
        const personal = await request.get(
          "/_internal/catalog/sections/910001/viewer",
          { headers },
        );
        expect(await personal.json()).toMatchObject({
          viewer: { signedIn: false, isSubscribed: true },
          homeworkData: {
            homeworks: [
              { id: "demo-homework-determinants" },
              { id: "demo-homework-vectors" },
              { id: "demo-homework-matrices" },
              { id: "demo-homework-project" },
            ],
            auditLogs: [],
          },
        });
        for (const path of [
          "/catalog/sections/910001",
          "/catalog/courses/920001",
          "/catalog/teachers/401",
        ]) {
          const page = await request.get(path, { headers });
          expect(page.status()).toBe(200);
          expect(await page.text()).toContain(
            path.includes("teachers") ? teacherName : courseName,
          );
        }
      }
    });
  });

  test("demo requests cannot reach durable data or external side effects", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const todo = await isolatedWorker.database.owner.todo.create({
        data: { userId: actor.id, title: "Unrelated private task" },
      });
      const before = await databaseSnapshot(isolatedWorker);
      const id = crypto.randomUUID();
      const probePath = `/__test/community-effects?id=${id}`;
      const registered = await request.post(`${probePath}&io=1`, {
        headers: secret,
      });
      expect(registered.status()).toBe(201);
      await registered.body();
      try {
        const probeHeaders = {
          ...secret,
          "x-test-community-probe": id,
        };
        const cookie = await enter(
          request,
          isolatedWorker.origin,
          probeHeaders,
        );
        const headers = {
          ...probeHeaders,
          cookie: cookieHeader(cookie),
          origin: isolatedWorker.origin,
        };
        for (const [method, path] of [
          ["POST", "/workspace/todos?/createTodo"],
          ["POST", "/api/workspace/todos"],
          ["POST", "/workspace/subscriptions?/subscribe"],
          ["PATCH", "/api/workspace/subscriptions"],
          ["DELETE", "/api/workspace/subscriptions"],
          ["PATCH", "/api/workspace/subscriptions/910001"],
          ["POST", "/api/workspace/subscriptions/batch"],
          ["POST", "/api/workspace/subscriptions/import-codes"],
          ["POST", "/api/workspace/subscriptions/query"],
          ["GET", "/workspace/subscriptions/activities"],
          ["GET", "/catalog/sections/910001/homework"],
          ["GET", "/api/catalog/sections/910001/calendar.ics"],
          ["POST", "/catalog/sections/910001?/subscribe"],
          ["POST", "/api/community/descriptions"],
          ["POST", "/api/community/comments"],
          ["POST", "/api/workspace/homeworks"],
          ["POST", "/api/community/section-homeworks"],
          ["POST", "/workspace/homeworks?/createHomework"],
          ["PATCH", "/api/community/section-homeworks/demo-homework-vectors"],
          ["DELETE", "/api/community/section-homeworks/demo-homework-vectors"],
          [
            "POST",
            "/api/community/section-homeworks/demo-homework-vectors/completion",
          ],
          ["POST", "/api/community/section-homeworks/completion/batch"],
          ["PATCH", `/api/workspace/todos/${todo.id}`],
          ["DELETE", `/api/workspace/todos/${todo.id}`],
          ["PATCH", "/api/workspace/todos/batch"],
          ["DELETE", "/api/workspace/todos/batch"],
          ["GET", "/api/catalog/links/resolve?slug=jw"],
          ["GET", "/api/workspace/uploads/private/download"],
          ["POST", "/api/workspace/uploads"],
          ["GET", "/api/calendar-feeds/private.ics"],
          ["GET", "/oauth/authorize"],
          ["POST", "/api/auth/oauth2/token"],
          ["GET", "/admin/users"],
          ["POST", "/api/graphql"],
          ["POST", "/api/mcp"],
          ["GET", "/catalog/courses"],
          ["POST", "/_internal/edge-cache/purge"],
        ]) {
          const response = await request.fetch(path, {
            method,
            headers,
            ...(method !== "GET"
              ? { data: { title: "Blocked", completed: true, ids: [todo.id] } }
              : {}),
            maxRedirects: 0,
          });
          expect(response.status(), `${method} ${path}`).toBe(403);
          expect(response.headers()["cache-control"]).toBe("private, no-store");
          expect(response.headers()["cloudflare-cdn-cache-control"]).toBe(
            "no-store",
          );
          expect(
            response.headers()["x-life-public-navigation"],
          ).toBeUndefined();
          await response.body();
        }
        for (const path of [
          "/workspace/todos",
          "/workspace/todos/__data.json",
          "/api/workspace/todos",
          "/workspace/subscriptions",
          "/workspace/homeworks",
          "/workspace/subscriptions/__data.json",
          "/api/workspace/subscriptions/current",
          "/_internal/shell-bootstrap",
          "/workspace/homeworks",
          "/workspace/homeworks/__data.json",
          "/api/workspace/homeworks",
          "/api/community/section-homeworks?sectionId=101",
          "/api/community/section-homeworks?sectionJwId=910001&sectionIds=101",
          "/api/community/section-homeworks/demo-homework-vectors",
          "/api/community/section-homeworks/audit?sectionId=101",
          "/_internal/catalog/sections/910001/viewer?homeworkId=demo-homework-vectors",
          "/api/community/comments?targetType=homework&targetId=demo-homework-vectors",
          "/catalog/sections/910001?homeworkId=demo-homework-vectors",
          "/catalog/sections/910001/__data.json",
          "/catalog/courses/920001",
          "/catalog/courses/920001/__data.json",
          "/catalog/teachers/401",
          "/catalog/teachers/401/__data.json",
          "/api/catalog/sections/910001",
          "/api/catalog/sections/910001?includeTeacherDepartments=true",
          "/_internal/catalog/sections/910001/viewer",
          "/api/community/descriptions?targetType=section&targetId=101",
          "/api/community/descriptions?targetType=course&targetId=201",
          "/api/community/descriptions?targetType=teacher&targetId=401",
          "/api/community/comments?targetType=section&targetId=101",
          "/api/community/comments?targetType=course&courseJwId=920001",
          "/api/community/comments?targetType=teacher&teacherId=401",
          "/api/community/comments?targetType=section-teacher&sectionJwId=910001&teacherId=401",
        ]) {
          const response = await request.get(path, { headers });
          expect(response.status()).toBe(200);
          expect(response.headers()["cache-control"]).toBe("private, no-store");
          expect(response.headers()["x-robots-tag"]).toBe(
            "noindex, nofollow, noarchive",
          );
          expect(
            response.headers()["x-life-public-navigation"],
          ).toBeUndefined();
          const body = await response.text();
          expect(body).not.toContain("application/ld+json");
          expect(body).not.toContain(todo.title);
          expect(body).not.toContain("googletagmanager.com");
          expect(body).not.toContain('gtag("config"');
        }
        for (const path of [
          "/catalog/sections/999999",
          "/catalog/sections/910001?homeworkId=private",
          "/catalog/sections/910001?homeworkId=demo-homework-physics",
          "/_internal/catalog/sections/910001/viewer?homeworkId=demo-homework-physics",
          "/api/community/section-homeworks?sectionIds=101,999",
          "/api/community/section-homeworks?sectionId=101&sectionJwId=910002",
          "/api/community/section-homeworks/private",
          "/api/community/section-homeworks/audit?sectionId=999",
          "/api/community/comments?targetType=homework&targetId=private",
          "/api/community/comments?targetType=homework&targetId=demo-homework-vectors&homeworkId=demo-homework-physics",
          "/catalog/courses/999999",
          "/catalog/teachers/999999",
          "/api/catalog/sections/999999",
          "/_internal/catalog/sections/999999/viewer",
          "/api/community/comments?targetType=section-teacher&sectionId=102&teacherId=402",
          ...["comments", "descriptions"].flatMap((kind) => [
            `/api/community/${kind}?targetType=section&targetId=999`,
            `/api/community/${kind}?targetType=section&targetId=101&sectionJwId=910002`,
            `/api/community/${kind}?targetType=course&targetId=201&courseJwId=920002`,
            `/api/community/${kind}?targetType=teacher&targetId=401&teacherId=402`,
            `/api/community/${kind}?targetType=section&targetId=101&teacherId=401`,
          ]),
        ]) {
          const response = await request.get(path, { headers });
          expect(response.status(), path).toBe(404);
          await response.body();
        }
        for (const path of [
          "/api/community/descriptions?targetType=section-teacher&sectionId=101&teacherId=401",
          "/api/community/descriptions?targetType=section&targetId=101&sectionId=101",
          "/api/community/comments?targetType=section&targetId=101&unrelated=1",
        ]) {
          const response = await request.get(path, { headers });
          expect(response.status(), path).toBe(400);
          await response.body();
        }
        const locale = await request.post("/api/account/preferences", {
          headers,
          data: { locale: "en-us" },
        });
        expect(locale.status()).toBe(200);
        await locale.body();
        const exit = await request.post("/account/demo/exit", {
          headers,
          maxRedirects: 0,
        });
        expect(exit.status()).toBe(303);
        expect(exit.headers().location).toBe("/account/sign-in");
        expect(exit.headers()["set-cookie"]).toMatch(/^life-ustc\.demo=;/);
        await exit.body();
        const collected = await request.get(probePath, { headers: secret });
        const effects = await collected.json();
        expect(effects).toMatchObject({
          purges: [],
          messages: [],
          backgroundErrors: [],
          io: { bindings: [], outbound: [] },
        });
        expect(effects.requests.length).toBeGreaterThan(20);
        expect(
          effects.requests.every(
            (entry: { outcome: string }) => entry.outcome === "fulfilled",
          ),
        ).toBe(true);
        expect(await databaseSnapshot(isolatedWorker)).toEqual(before);
      } finally {
        const removed = await request.delete(probePath, { headers: secret });
        expect(removed.status()).toBe(204);
        await removed.body();
      }
    });
  });

  test("invalid and mixed demo cookies fail closed at the real Worker", {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor();
      const valid = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      });
      const expired = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000) - 901,
      });
      const old = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
        fixtureVersion: "todos-v0",
      });
      const before = await databaseSnapshot(isolatedWorker);
      for (const [cookie, status] of [
        ["life-ustc.demo=invalid", 401],
        [cookieHeader(expired), 401],
        [cookieHeader(old), 401],
        [`${cookieHeader(valid)}; ${cookieHeader(actor.cookie)}`, 403],
        [`${cookieHeader(valid)}; ${cookieHeader(valid)}`, 401],
      ] as const) {
        for (const path of [
          "/api/workspace/todos",
          "/api/workspace/subscriptions/current",
          "/workspace/subscriptions/__data.json",
          "/workspace/homeworks/__data.json",
          "/api/workspace/homeworks",
          "/api/catalog/sections/910001",
          "/catalog/sections/910001/__data.json",
          "/catalog/courses/920001/__data.json",
          "/catalog/teachers/401/__data.json",
          "/_internal/catalog/sections/910001/viewer",
          "/api/community/comments?targetType=course&targetId=201",
          "/api/community/descriptions?targetType=teacher&targetId=401",
        ]) {
          const response = await request.get(path, {
            headers: { cookie },
            maxRedirects: 0,
          });
          expect(response.status()).toBe(status);
          expect(response.headers()["cache-control"]).toBe("private, no-store");
          await response.body();
        }
      }
      for (const path of [
        "/workspace/todos",
        "/workspace/subscriptions",
        "/workspace/homeworks",
        "/catalog/sections/910001",
        "/catalog/courses/920001",
        "/catalog/teachers/401",
      ]) {
        const html = await request.get(path, {
          headers: { cookie: cookieHeader(expired), accept: "text/html" },
          maxRedirects: 0,
        });
        expect(html.status()).toBe(303);
        expect(html.headers().location).toBe("/account/sign-in");
        expect(html.headers()["set-cookie"]).toMatch(/^life-ustc\.demo=;/);
        await html.body();
      }
      expect(await databaseSnapshot(isolatedWorker)).toEqual(before);
    });
  });
});
