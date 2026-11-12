import { expect } from "@playwright/test";
import type { CommentNode } from "../../../../src/features/comments/server/comment-types";
import {
  commentRepliesResponseSchema,
  commentsListResponseSchema,
  commentThreadResponseSchema,
} from "../../../../src/lib/api/schemas/comments-response-schemas";
import { publicUserProfileResponseSchema } from "../../../../src/lib/api/schemas/misc-response-schema-core";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const rootId = "demo-comment-course-01";
const lastReply = "demo-comment-course-reply-11";
const flatten = (nodes: CommentNode[]): CommentNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.replies)]);
async function snapshot(worker: IsolatedWorker) {
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

for (const locale of ["en-us", "zh-cn"] as const)
  test(`demo community reads share fixed threads, pagination and no live effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const actor = await isolatedWorker.createActor();
      const course = await db.course.create({
        data: {
          id: 201,
          jwId: 920001,
          code: "REAL-PRIVATE",
          nameCn: "Real course sentinel",
        },
      });
      const real = await db.comment.create({
        data: {
          id: rootId,
          courseId: course.id,
          userId: actor.id,
          body: "Real private discussion must never become a demo sample",
          visibility: "logged_in_only",
        },
      });
      const ordinary = await actor.request.get(
        "/api/community/comments?targetType=course&targetId=201",
      );
      expect(ordinary.status()).toBe(200);
      const actual = commentsListResponseSchema.parse(await ordinary.json());
      expect(actual.pagination.total).toBe(1);
      expect(actual.data[0]).toMatchObject({
        id: real.id,
        body: real.body,
        author: { id: actor.id },
      });
      const before = await snapshot(isolatedWorker);
      const demo = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000),
      });
      const expired = await createSignedDemoCookie({
        issuedAt: Math.floor(Date.now() / 1000) - 901,
      });
      const secret = { "x-test-storage-secret": "local-test-storage-observer" };
      const probeId = crypto.randomUUID();
      const probe = `/__test/community-effects?id=${probeId}`;
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      expect(registration.status()).toBe(201);
      await registration.body();
      const headers = {
        ...secret,
        "x-test-community-probe": probeId,
        cookie: `${demo.name}=${demo.value}; NEXT_LOCALE=${locale}`,
        origin: isolatedWorker.origin,
      };
      let requests = 0;
      const read = async (
        path: string,
        status = 200,
        method = "GET",
        override: Record<string, string> = {},
      ) => {
        requests++;
        const response = await request.fetch(path, {
          method,
          headers: { ...headers, ...override },
          maxRedirects: 0,
        });
        expect(response.status(), `${method} ${path}`).toBe(status);
        expect(response.headers()).toMatchObject({
          "cache-control": "private, no-store",
          "cloudflare-cdn-cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow, noarchive",
          vary: "Cookie",
        });
        expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
        return response;
      };
      try {
        const first = commentsListResponseSchema.parse(
          await (
            await read("/api/community/comments?targetType=course&targetId=201")
          ).json(),
        );
        expect(first.pagination).toEqual({
          page: 1,
          pageSize: 20,
          total: 21,
          totalPages: 2,
        });
        expect(first.data.map(({ id }) => id)).toEqual(
          Array.from(
            { length: 20 },
            (_, i) => `demo-comment-course-${String(i + 1).padStart(2, "0")}`,
          ),
        );
        expect(flatten(first.data[0].replies)).toHaveLength(10);
        expect(flatten(first.data).some(({ id }) => id === lastReply)).toBe(
          false,
        );
        for (const node of flatten(first.data)) {
          expect(node.body).not.toContain(real.body);
          expect(node.author).toMatchObject({
            isGuest: false,
            isAdmin: false,
            isUstcVerified: false,
            image: "/images/icon.png",
          });
          expect(node.author?.name).toContain(
            locale === "en-us" ? "Sample student" : "样例同学",
          );
          expect(node).toMatchObject({
            isAnonymous: false,
            authorHidden: false,
            isAuthor: false,
            attachments: [],
            canReply: false,
            canReact: false,
            canEdit: false,
            canDelete: false,
            canModerate: false,
          });
          expect(node.reactions).toEqual([
            { type: "upvote", count: 3, viewerHasReacted: false },
          ]);
        }
        expect(first.data[0].renderedBody).toContain("katex");
        expect(first.data[0].renderedBody).toContain("<table>");
        const cursor = first.data[0].repliesNextCursor;
        expect(cursor).toBeTruthy();
        const continued = commentRepliesResponseSchema.parse(
          await (
            await read(
              `/api/community/comments/${rootId}/replies?${new URLSearchParams({ cursor: cursor ?? "", pageSize: "20" })}`,
            )
          ).json(),
        );
        expect(continued.nextCursor).toBeNull();
        expect(flatten(continued.thread).map(({ id }) => id)).toEqual([
          rootId,
          lastReply,
        ]);
        for (const [page, ids] of [
          [2, ["demo-comment-course-21"]],
          [3, []],
        ] as const) {
          const body = commentsListResponseSchema.parse(
            await (
              await read(
                `/api/community/comments?targetType=course&courseJwId=920001&page=${page}`,
              )
            ).json(),
          );
          expect(body.data.map(({ id }) => id)).toEqual(ids);
          expect(body.pagination).toEqual({
            page,
            pageSize: 20,
            total: 21,
            totalPages: 2,
          });
        }
        for (const [query, total] of [
          ["targetType=section&targetId=101", 1],
          ["targetType=teacher&teacherId=401", 1],
          ["targetType=section-teacher&sectionId=101&teacherId=401", 1],
          ["targetType=homework&homeworkId=demo-homework-vectors", 1],
          ["targetType=course&targetId=202", 0],
          ["targetType=teacher&teacherId=402", 0],
          ["targetType=section&targetId=102", 0],
          ["targetType=section-teacher&sectionId=101&teacherId=402", 0],
          ["targetType=homework&homeworkId=demo-homework-physics", 0],
        ] as const) {
          const body = commentsListResponseSchema.parse(
            await (await read(`/api/community/comments?${query}`)).json(),
          );
          expect(body.pagination).toMatchObject({ total, totalPages: 1 });
          expect(body.data).toHaveLength(total);
          expect(body.meta).toMatchObject({
            hiddenCount: 0,
            viewer: { userId: null, isAuthenticated: false },
          });
        }
        for (const id of [
          lastReply,
          "demo-comment-course-21",
          "demo-comment-course-reply-03",
        ]) {
          const focused = commentThreadResponseSchema.parse(
            await (await read(`/api/community/comments/${id}`)).json(),
          );
          expect(focused.focusId).toBe(id);
          expect(flatten(focused.thread).map(({ id }) => id)).toContain(id);
          const permalink = await read(`/community/comments/${id}`, 303);
          expect(permalink.headers().location).toBe(
            `/catalog/courses/920001#comment-${id}`,
          );
          await permalink.body();
        }
        for (const [id, href] of [
          ["demo-comment-section-101", "/catalog/sections/910001"],
          ["demo-comment-teacher-401", "/catalog/teachers/401"],
          ["demo-comment-section-teacher-101-401", "/catalog/sections/910001"],
          [
            "demo-comment-homework-vectors",
            "/catalog/sections/910001?homeworkId=demo-homework-vectors",
          ],
        ]) {
          const response = await read(`/community/comments/${id}`, 303);
          expect(response.headers().location).toBe(`${href}#comment-${id}`);
          await response.body();
        }
        for (const path of [
          `/api/community/comments/${rootId}`,
          `/api/community/comments/${rootId}/replies`,
        ]) {
          const response = await read(path, 200, "HEAD");
          expect(await response.body()).toHaveLength(0);
        }
        for (const [path, status] of [
          [
            "/api/community/comments?targetType=course&targetId=201&courseJwId=920002",
            404,
          ],
          [
            "/api/community/comments?targetType=section-teacher&sectionId=102&teacherId=402",
            404,
          ],
          [
            "/api/community/comments?targetType=course&targetId=201&pageSize=101",
            400,
          ],
          ["/api/community/comments/demo-comment-unknown", 404],
          ["/api/community/comments/demo-comment-unknown/replies", 404],
          ["/community/comments/demo-comment-unknown", 404],
          ["/community/users/demo-community-unknown", 404],
          ["/api/community/users/demo-community-unknown", 404],
          [`/community/users/${actor.id}`, 404],
          [`/api/community/users/${actor.id}`, 404],
        ] as const)
          await (await read(path, status)).body();
        const authorName =
          locale === "en-us" ? "Sample student Xia" : "样例同学·小夏";
        const authorPage = await read("/community/users/demo-community-xia");
        const authorHtml = await authorPage.text();
        expect(authorHtml).toMatch(new RegExp(`<h1[^>]*>${authorName}</h1>`));
        expect(authorHtml).not.toContain(real.body);
        const authorProfile = publicUserProfileResponseSchema.parse(
          await (await read("/api/community/users/demo-community-xia")).json(),
        );
        expect(authorProfile.user).toEqual({
          id: "demo-community-xia",
          username: "sample-xia",
          name: authorName,
          image: "/images/icon.png",
          createdAt: "2026-09-01T01:00:00.000Z",
          _count: { comments: 35, homeworksCreated: 0, uploads: 0 },
        });
        expect(authorProfile.totalContributions).toBe(35);
        for (const claims of [
          {
            rootId: "demo-comment-section-101",
            id: "demo-comment-course-reply-10",
            createdAt: "2026-09-22T00:09:00.000Z",
          },
          {
            rootId,
            id: "demo-comment-section-101",
            createdAt: "2026-09-23T00:00:00.000Z",
          },
          {
            rootId,
            id: "demo-comment-missing",
            createdAt: "2026-09-22T00:09:00.000Z",
          },
          {
            rootId,
            id: "demo-comment-course-reply-10",
            createdAt: "2026-09-22T00:08:00.000Z",
          },
        ]) {
          const invalid = btoa(JSON.stringify({ ...claims, version: 1 }));
          await (
            await read(
              `/api/community/comments/${rootId}/replies?cursor=${encodeURIComponent(invalid)}`,
              400,
            )
          ).body();
        }
        for (const cookie of [
          `${expired.name}=${expired.value}`,
          "life-ustc.demo=invalid",
          `${headers.cookie}; ${actor.cookie.name}=${actor.cookie.value}`,
        ]) {
          const status = cookie.includes(actor.cookie.name) ? 403 : 401;
          for (const path of [
            `/api/community/comments/${rootId}`,
            `/api/community/comments/${rootId}/replies`,
          ])
            await (await read(path, status, "GET", { cookie })).body();
        }
        const refreshed = await read(
          `/community/comments/${rootId}`,
          303,
          "GET",
          { cookie: `${expired.name}=${expired.value}`, accept: "text/html" },
        );
        expect(refreshed.headers().location).toBe("/account/sign-in");
        expect(refreshed.headers()["set-cookie"]).toMatch(/^life-ustc\.demo=;/);
        await refreshed.body();
        for (const [method, path] of [
          ["POST", "/api/community/comments"],
          ["PATCH", `/api/community/comments/${rootId}`],
          ["DELETE", `/api/community/comments/${rootId}`],
          ["POST", `/api/community/comments/${rootId}/replies`],
          ["POST", `/api/community/comments/${rootId}/reactions`],
          ["DELETE", `/api/community/comments/${rootId}/reactions`],
          ["DELETE", "/api/community/comments/batch"],
          ["POST", "/api/graphql"],
          ["POST", "/api/mcp"],
        ])
          await (await read(path, 403, method)).body();
        const effects = await (
          await request.get(probe, { headers: secret })
        ).json();
        expect(effects).toMatchObject({
          purges: [],
          messages: [],
          backgroundErrors: [],
          io: { bindings: [], outbound: [] },
        });
        expect(effects.requests).toHaveLength(requests);
        expect(requests).toBeGreaterThan(40);
        expect(
          effects.requests.every(
            (entry: { outcome: string }) => entry.outcome === "fulfilled",
          ),
        ).toBe(true);
        expect(await snapshot(isolatedWorker)).toEqual(before);
      } finally {
        const removed = await request.delete(probe, { headers: secret });
        expect(removed.status()).toBe(204);
        await removed.body();
      }
    });
  });
