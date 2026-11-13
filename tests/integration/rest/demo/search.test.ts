import { type APIResponse, expect } from "@playwright/test";
import { unflatten } from "devalue";
import type {
  GlobalSearchResponse,
  GlobalSearchResultGroup,
  GlobalSearchResultGroupType,
  GlobalSearchResultItem,
} from "../../../../src/features/search/server/global-search-types";
import { isRecord } from "../../../../src/lib/is-record";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });

const order = [
  "sections",
  "teachers",
  "courses",
  "links",
  "homeworks",
  "todos",
];
function isItem(value: unknown): value is GlobalSearchResultItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.href === "string" &&
    (value.description === null || typeof value.description === "string") &&
    (value.code === undefined || typeof value.code === "string") &&
    (value.external === undefined || typeof value.external === "boolean") &&
    Object.keys(value).every((key) =>
      ["id", "title", "description", "href", "code", "external"].includes(key),
    )
  );
}
function isGroup(value: unknown): value is GlobalSearchResultGroup {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    order.includes(value.type) &&
    Array.isArray(value.items) &&
    value.items.every(isItem) &&
    Object.keys(value).sort().join(",") === "items,type"
  );
}
function result(value: unknown): GlobalSearchResponse {
  if (
    !isRecord(value) ||
    typeof value.query !== "string" ||
    !Array.isArray(value.groups) ||
    !value.groups.every(isGroup) ||
    Object.keys(value).sort().join(",") !== "groups,query"
  )
    throw new Error("Expected the complete global-search wire contract");
  const groups = value.groups;
  expect(new Set(groups.map((group) => group.type)).size).toBe(groups.length);
  expect(groups.map((group) => group.type)).toEqual(
    order.filter((type) => groups.some((group) => group.type === type)),
  );
  for (const group of groups) {
    expect(group.items.length).toBeGreaterThan(0);
    expect(new Set(group.items.map((item) => item.id)).size).toBe(
      group.items.length,
    );
  }
  return { query: value.query, groups };
}
function items(body: GlobalSearchResponse, type: GlobalSearchResultGroupType) {
  return body.groups.find((group) => group.type === type)?.items ?? [];
}
function privateHeaders(response: APIResponse) {
  expect(response.headers()).toMatchObject({
    "cache-control": "private, no-store",
    "cloudflare-cdn-cache-control": "no-store",
    vary: "Cookie",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
  expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
}
async function snapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const rows: Record<string, unknown[]> = {};
  for (const { tablename } of tables) {
    const name = tablename.replaceAll('"', '""');
    rows[tablename] = await db.$queryRawUnsafe<unknown[]>(
      'SELECT row_to_json(t)::text AS row FROM "' +
        name +
        '" t ORDER BY row_to_json(t)::text',
    );
  }
  return rows;
}

for (const locale of ["en-us", "zh-cn"] as const) {
  test("demo search seals shared catalog and workspace facts and effects " +
    locale, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const english = locale === "en-us";
      const db = isolatedWorker.database.owner;
      const actor = await isolatedWorker.createActor();
      const sentinel = `private-search-${crypto.randomUUID()}`;
      const course = await db.course.create({
        data: {
          jwId: 811001,
          code: sentinel,
          nameCn: sentinel,
          nameEn: sentinel,
        },
      });
      const teacher = await db.teacher.create({
        data: {
          jwId: 813001,
          code: sentinel,
          nameCn: sentinel,
          nameEn: sentinel,
        },
      });
      const section = await db.section.create({
        data: {
          jwId: 812001,
          code: sentinel,
          courseId: course.id,
          teachers: { connect: { id: teacher.id } },
        },
      });
      await db.userSectionSubscription.create({
        data: { userId: actor.id, sectionId: section.id },
      });
      const homework = await db.homework.create({
        data: {
          title: `${sentinel} homework`,
          sectionId: section.id,
          createdById: actor.id,
          submissionDueAt: new Date("2026-10-01T10:00:00+08:00"),
        },
      });
      const todo = await db.todo.create({
        data: {
          userId: actor.id,
          title: `${sentinel} todo`,
          content: `${sentinel} private content`,
          dueAt: new Date("2026-10-02T10:00:00+08:00"),
        },
      });
      const ordinaryCookie = `${actor.cookie.name}=${actor.cookie.value}`;
      const secret = { "x-test-storage-secret": "local-test-storage-observer" };
      const ordinaryProbeId = crypto.randomUUID();
      const ordinaryProbe = `/__test/community-effects?id=${ordinaryProbeId}`;
      let ordinaryRegistered = false;
      try {
        const registered = await request.post(ordinaryProbe, {
          headers: secret,
        });
        ordinaryRegistered = registered.status() === 201;
        await registered.body();
        expect(registered.status()).toBe(201);
        const ordinary = await request.get(
          "/api/search?" +
            new URLSearchParams({
              q: sentinel,
              scope: "workspace",
              locale,
              limit: "25",
            }),
          {
            headers: {
              ...secret,
              "x-test-community-probe": ordinaryProbeId,
              cookie: ordinaryCookie,
            },
          },
        );
        expect(ordinary.status()).toBe(200);
        const ordinaryBody = result(await ordinary.json());
        expect(ordinaryBody.query).toBe(sentinel);
        expect(ordinaryBody.groups.map((group) => group.type)).toEqual([
          "sections",
          "teachers",
          "courses",
          "homeworks",
          "todos",
        ]);
        expect(items(ordinaryBody, "sections").map((item) => item.id)).toEqual([
          "section:812001",
        ]);
        expect(items(ordinaryBody, "teachers").map((item) => item.id)).toEqual([
          `teacher:${teacher.id}`,
        ]);
        expect(items(ordinaryBody, "courses").map((item) => item.id)).toEqual([
          "course:811001",
        ]);
        expect(items(ordinaryBody, "homeworks")).toEqual([
          {
            id: `homework:${homework.id}`,
            title: homework.title,
            description: sentinel,
            href: `/catalog/sections/812001?homeworkId=${homework.id}#homework`,
          },
        ]);
        expect(items(ordinaryBody, "todos")).toEqual([
          {
            id: `todo:${todo.id}`,
            title: todo.title,
            description: "2026-10-02",
            href: "/workspace/todos",
          },
        ]);

        // Joining the real response and its waitUntil work keeps the ordinary
        // search's detached metrics outside the subsequent sealed Demo ledger.
        const drained = await request.get(ordinaryProbe, { headers: secret });
        expect(drained.status()).toBe(200);
        expect(await drained.json()).toMatchObject({
          backgroundErrors: [],
          requests: [
            {
              outcome: "fulfilled",
              value: { method: "GET", path: "/api/search" },
              result: 200,
            },
          ],
        });
        const requestId = ordinary.headers()["x-request-id"];
        expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
        expect(
          await db.featureOperationEvent.findMany({
            select: {
              feature: true,
              operation: true,
              protocol: true,
              requestId: true,
              outcome: true,
            },
          }),
        ).toEqual([
          {
            feature: "catalog.search",
            operation: "search",
            protocol: "rest",
            requestId,
            outcome: "success",
          },
        ]);
      } finally {
        // DELETE also drains if response consumption or the GET observation failed.
        const removed = await request.delete(ordinaryProbe, {
          headers: secret,
        });
        await removed.body();
        if (ordinaryRegistered) expect(removed.status()).toBe(204);
        else expect([204, 404]).toContain(removed.status());
      }

      // The real session/cache work above finishes before the sealed Demo ledger begins.
      const before = await snapshot(isolatedWorker);
      const privateValues = [
        actor.id,
        sentinel,
        homework.id,
        homework.title,
        todo.id,
        todo.title,
      ];
      const now = Math.floor(Date.now() / 1000);
      const signed = await createSignedDemoCookie({ issuedAt: now });
      const expired = await createSignedDemoCookie({ issuedAt: now - 901 });
      const cookie = `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`;
      const probeId = crypto.randomUUID();
      const probe = `/__test/community-effects?id=${probeId}`;
      const registered = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      await registered.body();
      expect(registered.status()).toBe(201);
      const admitted: { method: string; path: string }[] = [];
      const read = async (
        path: string,
        status = 200,
        method = "GET",
        extra: Record<string, string> = {},
      ) => {
        admitted.push({
          method,
          path: new URL(path, isolatedWorker.origin).pathname,
        });
        const response = await request.fetch(path, {
          method,
          maxRedirects: 0,
          headers: {
            ...secret,
            "x-test-community-probe": probeId,
            cookie,
            origin: isolatedWorker.origin,
            ...extra,
          },
          ...(["POST", "PUT", "PATCH", "DELETE"].includes(method)
            ? { data: { q: "algebra" } }
            : {}),
        });
        await response.body();
        expect(response.status(), `${method} ${path}`).toBe(status);
        privateHeaders(response);
        return response;
      };
      const search = async (
        query: string,
        scope = "catalog",
        limit?: number,
      ) => {
        const params = new URLSearchParams({ q: query, scope, locale });
        if (limit !== undefined) params.set("limit", String(limit));
        const body = result(await (await read(`/api/search?${params}`)).json());
        expect(body.query).toBe(query.trim());
        for (const value of privateValues)
          expect(JSON.stringify(body.groups)).not.toContain(value);
        return body;
      };
      try {
        const expectedSections = [
          [
            910001,
            "DEMO-MATH01.01",
            english
              ? "Linear Algebra · Teacher Chen, Teacher Lin"
              : "线性代数 · 陈老师、林老师",
            english ? "Fall 2026" : "2026年秋季学期",
          ],
          [
            910002,
            "DEMO-PHYS01.01",
            english ? "College Physics · Teacher Chen" : "大学物理 · 陈老师",
            english ? "Fall 2026" : "2026年秋季学期",
          ],
          [
            910003,
            "DEMO-CS01.01",
            english ? "Data Structures · Teacher Lin" : "数据结构 · 林老师",
            english ? "Spring 2026" : "2026年春季学期",
          ],
        ].map(([id, code, title, description]) => ({
          id: `section:${id}`,
          code,
          title,
          description,
          href: `/catalog/sections/${id}`,
        }));
        const expectedTeachers = [
          [402, english ? "Teacher Lin" : "林老师", "DEMO-T02"],
          [401, english ? "Teacher Chen" : "陈老师", "DEMO-T01"],
        ].map(([id, title, description]) => ({
          id: `teacher:${id}`,
          title,
          description,
          href: `/catalog/teachers/${id}`,
        }));
        const expectedCourses = [
          [920003, english ? "Data Structures" : "数据结构", "DEMO-CS01"],
          [920001, english ? "Linear Algebra" : "线性代数", "DEMO-MATH01"],
          [920002, english ? "College Physics" : "大学物理", "DEMO-PHYS01"],
        ].map(([id, title, description]) => ({
          id: `course:${id}`,
          title,
          description,
          href: `/catalog/courses/${id}`,
        }));
        const expectedHomeworks = [
          [
            "structures",
            910003,
            english ? "Data structures course project" : "数据结构课程项目",
            english ? "Data Structures" : "数据结构",
          ],
          [
            "determinants",
            910001,
            english ? "Determinants exercises" : "行列式练习",
            english ? "Linear Algebra" : "线性代数",
          ],
          [
            "vectors",
            910001,
            english ? "Vector spaces exercises" : "向量空间练习",
            english ? "Linear Algebra" : "线性代数",
          ],
          [
            "matrices",
            910001,
            english ? "Matrix operations exercises" : "矩阵运算练习",
            english ? "Linear Algebra" : "线性代数",
          ],
          [
            "physics",
            910002,
            english ? "Mechanics further reading" : "力学拓展阅读",
            english ? "College Physics" : "大学物理",
          ],
          [
            "project",
            910001,
            english ? "Linear algebra team project" : "线性代数小组项目",
            english ? "Linear Algebra" : "线性代数",
          ],
        ].map(([id, sectionId, title, description]) => ({
          id: `homework:demo-homework-${id}`,
          title,
          description,
          href:
            "/catalog/sections/" +
            sectionId +
            "?homeworkId=demo-homework-" +
            id +
            "#homework",
        }));
        const expectedTodos = [
          {
            id: "todo:demo-todo-reading",
            title: english ? "Review linear algebra" : "预习线性代数",
            description: "2026-09-23",
            href: "/workspace/todos",
          },
          {
            id: "todo:demo-todo-outline",
            title: english ? "Organize course notes" : "整理课程笔记",
            description: "2026-09-25",
            href: "/workspace/todos",
          },
          {
            id: "todo:demo-todo-library",
            title: english ? "Return library books" : "归还图书",
            description: "completed",
            href: "/workspace/todos",
          },
        ];
        const catalog = await search("%_", "catalog", 25);
        expect(catalog.groups).toEqual([
          { type: "sections", items: expectedSections },
          { type: "teachers", items: expectedTeachers },
          { type: "courses", items: expectedCourses },
        ]);
        const workspace = await search("%_", "workspace", 25);
        expect(workspace.groups).toEqual([
          ...catalog.groups,
          { type: "homeworks", items: expectedHomeworks },
          { type: "todos", items: expectedTodos },
        ]);
        expect((await search(sentinel, "workspace", 25)).groups).toEqual([]);
        const one = await search("%_", "workspace", 1);
        expect(one.groups).toEqual(
          workspace.groups.map((group) => ({
            ...group,
            items: group.items.slice(0, 1),
          })),
        );
        const defaults = await search("%_", "workspace");
        expect(defaults.groups).toEqual(
          workspace.groups.map((group) => ({
            ...group,
            items: group.items.slice(0, 5),
          })),
        );
        expect(
          items(defaults, "homeworks").map((item) => item.id),
        ).not.toContain("homework:demo-homework-project");
        expect((await search("\\%\\_", "workspace", 25)).groups).toEqual([]);
        expect((await search("name:Algebra", "workspace", 25)).groups).toEqual(
          [],
        );
        const crossFields = await search("algebra DEMO-T02");
        expect(crossFields.groups).toEqual([
          { type: "sections", items: [expectedSections[0]] },
        ]);
        for (const query of [
          "L Li Lin Line Linea Linear impossible",
          "L L Li Lin Line Linea Linear impossible",
        ])
          expect((await search(query)).groups).toEqual([
            { type: "sections", items: [expectedSections[0]] },
            { type: "courses", items: [expectedCourses[1]] },
          ]);
        expect(
          (await search("L Li Lin Line Linea impossible Linear")).groups,
        ).toEqual([]);
        expect(
          (await search(english ? "chapter 3" : "第三章", "workspace")).groups,
        ).toEqual([{ type: "todos", items: [expectedTodos[0]] }]);

        const algebra = await search("  algebra DEMO-MATH01  ");
        expect(algebra.groups).toEqual([
          { type: "sections", items: [expectedSections[0]] },
          { type: "courses", items: [expectedCourses[1]] },
        ]);
        const alias = result(
          await (
            await read(
              "/api/search?" +
                new URLSearchParams({ query: "algebra DEMO-MATH01", locale }),
            )
          ).json(),
        );
        expect(alias).toEqual({ ...algebra, query: "algebra DEMO-MATH01" });
        const precedence = result(
          await (
            await read(
              "/api/search?" +
                new URLSearchParams({ q: "", query: "algebra", locale }),
            )
          ).json(),
        );
        expect(precedence).toEqual({ query: "", groups: [] });
        expect(
          result(
            await (
              await read(
                "/api/search?" +
                  new URLSearchParams({
                    q: "DEMO-MATH01",
                    query: "missing",
                    locale,
                    extra: "ignored",
                    userId: actor.id,
                  }),
              )
            ).json(),
          ),
        ).toEqual({
          query: "DEMO-MATH01",
          groups: [
            { type: "sections", items: [expectedSections[0]] },
            { type: "courses", items: [expectedCourses[1]] },
          ],
        });
        const defaultLocale = result(
          await (await read("/api/search?q=DEMO-MATH01")).json(),
        );
        expect(items(defaultLocale, "courses")).toEqual([
          {
            id: "course:920001",
            title: "线性代数",
            description: "DEMO-MATH01",
            href: "/catalog/courses/920001",
          },
        ]);

        // Every search route refers to the same existing catalog/workspace wire facts.
        for (const [kind, expected] of [
          ["courses", expectedCourses],
          ["teachers", expectedTeachers],
        ] as const) {
          const collection: unknown = await (
            await read(`/api/catalog/${kind}?pageSize=25&locale=${locale}`)
          ).json();
          if (
            !isRecord(collection) ||
            !Array.isArray(collection.data) ||
            !collection.data.every(isRecord)
          )
            throw new Error("Expected the allowed catalog collection");
          expect(collection.pagination).toEqual({
            page: 1,
            pageSize: 25,
            total: expected.length,
            totalPages: 1,
          });
          expect(
            collection.data.map((row) => ({
              title: row.namePrimary,
              code: row.code,
            })),
          ).toEqual(
            expected.map((item) => ({
              title: item.title,
              code: item.description,
            })),
          );
          for (const item of expected) {
            const html = await (
              await read(item.href, 200, "GET", { accept: "text/html" })
            ).text();
            expect(html).toContain(item.title);
            expect(html).toContain(item.description);
            const envelope: unknown = await (
              await read(`${item.href}/__data.json`)
            ).json();
            if (!isRecord(envelope) || !Array.isArray(envelope.nodes))
              throw new Error("Expected the existing catalog detail page data");
            const nodes: Record<string, unknown>[] = [];
            for (const node of envelope.nodes) {
              if (!isRecord(node) || !Array.isArray(node.data)) continue;
              const value: unknown = unflatten(node.data);
              if (!isRecord(value))
                throw new Error("Expected a decoded catalog detail data node");
              nodes.push(value);
            }
            const detail: Record<string, unknown> = Object.assign({}, ...nodes);
            expect(
              detail[kind === "courses" ? "course" : "teacher"],
            ).toMatchObject({
              namePrimary: item.title,
              code: item.description,
            });
            // These detail APIs remain outside the delivered Demo read surface.
            await read(`/api${item.href}`, 403);
          }
        }
        for (const item of expectedSections) {
          const dto: unknown = await (
            await read(`/api${item.href}?locale=${locale}`)
          ).json();
          expect(dto).toMatchObject({
            jwId: Number(item.id.slice("section:".length)),
            code: item.code,
          });
        }
        for (const item of expectedHomeworks) {
          const id = item.id.slice("homework:".length);
          const dto: unknown = await (
            await read(`/api/community/section-homeworks/${id}`)
          ).json();
          expect(dto).toMatchObject({ homework: { id, title: item.title } });
          const target = new URL(item.href, isolatedWorker.origin);
          expect(target.hash).toBe("#homework");
          const html = await (
            await read(target.pathname + target.search, 200, "GET", {
              accept: "text/html",
            })
          ).text();
          expect(html).toContain(item.description);
          const envelope: unknown = await (
            await read(`${target.pathname}/__data.json${target.search}`)
          ).json();
          if (!isRecord(envelope) || !Array.isArray(envelope.nodes))
            throw new Error("Expected the homework target's section page data");
          const nodes: Record<string, unknown>[] = [];
          for (const node of envelope.nodes) {
            if (!isRecord(node) || !Array.isArray(node.data)) continue;
            const value: unknown = unflatten(node.data);
            if (!isRecord(value))
              throw new Error("Expected decoded section page data");
            nodes.push(value);
          }
          expect(Object.assign({}, ...nodes)).toMatchObject({
            section: { jwId: Number(target.pathname.split("/").at(-1)) },
            focusedHomeworkId: id,
            homeworkData: { homeworks: [] },
          });
          // The existing page hydrates personal homework details separately.
          const personal: unknown = await (
            await read(`/_internal${target.pathname}/viewer${target.search}`)
          ).json();
          expect(personal).toMatchObject({
            viewer: { signedIn: false, isSubscribed: true },
            homeworkData: {
              homeworks: expect.arrayContaining([
                expect.objectContaining({
                  id,
                  title: item.title,
                  description: expect.objectContaining({
                    id: `demo-description-${id}`,
                    homeworkId: id,
                    content: english
                      ? "Read the course notes and explain your reasoning for each exercise."
                      : "阅读课程笔记，并写出每道练习的推导过程。",
                  }),
                }),
              ]),
              viewer: { isAuthenticated: false, userId: null },
            },
          });
        }
        const todos: unknown = await (
          await read("/api/workspace/todos")
        ).json();
        if (
          !isRecord(todos) ||
          !Array.isArray(todos.todos) ||
          !todos.todos.every(isRecord)
        )
          throw new Error("Expected all actual Demo todos");
        expect(
          todos.todos.map((row) => ({
            id: `todo:${row.id}`,
            title: row.title,
          })),
        ).toEqual(expectedTodos.map(({ id, title }) => ({ id, title })));
        expect(todos.todos.at(-1)).toMatchObject({
          completed: true,
          dueAt: null,
        });

        const linkBody: unknown = await (
          await read(`/api/catalog/links?locale=${locale}`)
        ).json();
        if (
          !isRecord(linkBody) ||
          !Array.isArray(linkBody.links) ||
          !linkBody.links.every(isRecord)
        )
          throw new Error("Expected the existing public website catalog");
        const links = linkBody.links;
        expect(links).toHaveLength(65);
        expect(new Set(links.map((link) => link.slug)).size).toBe(65);
        expect(links.find((link) => link.slug === "jw")).toMatchObject({
          title: english ? "Academic Affairs System" : "教务系统",
          url: "https://jw.ustc.edu.cn/",
        });
        expect(links.find((link) => link.slug === "library")).toMatchObject({
          title: english ? "Library" : "图书馆",
          url: "https://lib.ustc.edu.cn/",
        });
        const found = new Set<string>();
        for (const link of links) {
          if (
            typeof link.title !== "string" ||
            typeof link.slug !== "string" ||
            typeof link.description !== "string"
          )
            throw new Error("Expected a complete public website label");
          expect(link).not.toHaveProperty("clickCount");
          expect(link).not.toHaveProperty("isPinned");
          const matches = items(
            await search(link.title, "catalog", 25),
            "links",
          );
          expect(
            matches.some((item) => item.id === `link:${link.slug}`),
            link.slug,
          ).toBe(true);
          found.add(link.slug);
          for (const hit of matches) {
            const source = links.find((row) => hit.id === `link:${row.slug}`);
            expect(source).toBeDefined();
            if (!source || typeof source.slug !== "string")
              throw new Error("Unknown website result");
            expect(hit).toEqual({
              id: `link:${source.slug}`,
              title: source.title,
              description: source.description,
              href: `/catalog/links#link-${encodeURIComponent(source.slug)}`,
              external: false,
            });
          }
        }
        expect(found.size).toBe(65);
        expect(
          items(await search("tushuguan"), "links")
            .map((item) => item.id)
            .sort(),
        ).toEqual(["link:library", "link:study-space-booking"]);
        const library = items(
          await search(english ? "library" : "图书馆", "workspace"),
          "links",
        );
        expect(library.find((item) => item.id === "link:library")).toEqual({
          id: "link:library",
          title: english ? "Library" : "图书馆",
          description: links.find((link) => link.slug === "library")
            ?.description,
          href: "/catalog/links#link-library",
          external: false,
        });

        const bootstrap: unknown = await (
          await read("/_internal/shell-bootstrap")
        ).json();
        expect(bootstrap).toMatchObject({
          viewer: null,
          demo: { referenceNow: "2026-09-24T09:00:00+08:00" },
        });
        const page = `/search?q=${encodeURIComponent("algebra")}`;
        const html = await (
          await read(page, 200, "GET", { accept: "text/html" })
        ).text();
        expect(html).toContain(`lang="${locale}"`);
        expect(html).toContain('id="global-search-page-input"');
        for (const value of privateValues) expect(html).not.toContain(value);
        const envelope: unknown = await (
          await read("/search/__data.json?q=algebra")
        ).json();
        if (!isRecord(envelope) || !Array.isArray(envelope.nodes))
          throw new Error("Expected real search page data");
        const nodes: Record<string, unknown>[] = [];
        for (const node of envelope.nodes) {
          if (!isRecord(node) || !Array.isArray(node.data)) continue;
          const value: unknown = unflatten(node.data);
          if (!isRecord(value))
            throw new Error("Expected a decoded page data node");
          nodes.push(value);
        }
        const loaded: Record<string, unknown> = Object.assign({}, ...nodes);
        expect(loaded).toMatchObject({
          user: null,
          locale,
          demo: { referenceNow: "2026-09-24T09:00:00+08:00" },
          copy: { pageTitle: english ? "Search" : "搜索" },
        });
        for (const value of privateValues)
          expect(JSON.stringify(loaded)).not.toContain(value);

        for (const query of ["", " a ", "z".repeat(200)])
          expect((await search(query, "workspace")).groups).toEqual([]);
        for (const [query, message] of [
          [
            `q=${"z".repeat(201)}`,
            "Search query must not exceed 200 characters",
          ],
          ["q=algebra&limit=0", "Invalid limit"],
          ["q=algebra&limit=26", "Invalid limit"],
          ["q=algebra&limit=1.5", "Invalid limit"],
          ["q=algebra&limit=not-a-number", "Invalid limit"],
          ["q=algebra&scope=unknown", "Invalid search scope"],
          ["q=algebra&scope=", "Invalid search scope"],
          ["q=algebra&locale=invalid", "Invalid locale"],
        ])
          expect(
            await (await read(`/api/search?${query}`, 400)).json(),
          ).toEqual({ error: message });
        for (const target of [
          `/api/search?q=algebra&scope=workspace&locale=${locale}`,
          page,
          "/search/__data.json?q=algebra",
        ]) {
          expect(await (await read(target, 200, "HEAD")).body()).toHaveLength(
            0,
          );
          for (const identity of [
            `${signed.name}=invalid`,
            `${expired.name}=${expired.value}`,
          ])
            await read(target, 401, "GET", {
              cookie: identity,
              accept: "application/json",
            });
          await read(target, 403, "GET", {
            cookie: `${cookie}; ${ordinaryCookie}`,
          });
          for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
            const denied = await read(target, 403, method);
            expect(denied.headers().location).toBeUndefined();
          }
        }
        const signIn = await read(page, 303, "GET", {
          cookie: `${expired.name}=${expired.value}`,
          accept: "text/html",
        });
        expect(signIn.headers().location).toBe("/account/sign-in");
        for (const target of [
          "/api/catalog/sections/812001",
          `/api/community/section-homeworks/${homework.id}`,
        ]) {
          const denied = await read(target, 404);
          expect(await denied.text()).not.toContain(sentinel);
        }
        for (const target of [
          "/catalog/courses/811001",
          `/catalog/teachers/${teacher.id}`,
        ]) {
          const denied = await read(target, 404, "GET", {
            accept: "text/html",
          });
          expect(await denied.text()).not.toContain(sentinel);
          await read(`/api${target}`, 403);
        }
        const resolver = await read(
          "/api/catalog/links/resolve?slug=library",
          403,
        );
        expect(resolver.headers().location).toBeUndefined();

        const effects: unknown = await (
          await request.get(probe, { headers: secret })
        ).json();
        expect(effects).toMatchObject({
          purges: [],
          messages: [],
          backgroundErrors: [],
          io: { bindings: [], outbound: [] },
        });
        if (
          !isRecord(effects) ||
          !Array.isArray(effects.requests) ||
          !effects.requests.every(isRecord)
        )
          throw new Error("Expected complete request observations");
        expect(
          effects.requests.every((entry) => entry.outcome === "fulfilled"),
        ).toBe(true);
        const counts = new Map<string, number>();
        for (const entry of admitted) {
          const key = `${entry.method} ${entry.path}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        for (const [key, count] of counts)
          expect(
            effects.requests.filter(
              (entry) =>
                isRecord(entry.value) &&
                entry.outcome === "fulfilled" &&
                `${entry.value.method} ${entry.value.path}` === key,
            ).length,
            key,
          ).toBeGreaterThanOrEqual(count);
        expect(await snapshot(isolatedWorker)).toEqual(before);
      } finally {
        const removed = await request.delete(probe, { headers: secret });
        await removed.body();
        expect(removed.status()).toBe(204);
      }
    });
  });
}
