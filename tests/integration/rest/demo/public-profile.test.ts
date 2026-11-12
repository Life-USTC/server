import { type APIResponse, expect } from "@playwright/test";
import { unflatten } from "devalue";
import type { Root } from "hast";
import rehypeParse from "rehype-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { CommentNode } from "../../../../src/features/comments/server/comment-types";
import {
  commentsListResponseSchema,
  commentThreadResponseSchema,
} from "../../../../src/lib/api/schemas/comments-response-schemas";
import { publicUserProfileResponseSchema } from "../../../../src/lib/api/schemas/misc-response-schema-core";
import { isRecord } from "../../../../src/lib/is-record";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const flatten = (nodes: CommentNode[]): CommentNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.replies)]);
async function snapshot(worker: IsolatedWorker) {
  const db = worker.database.owner;
  const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const rows: Record<string, unknown[]> = {};
  for (const { tablename } of tables)
    rows[tablename] = await db.$queryRawUnsafe(
      'SELECT row_to_json(t)::text AS row FROM "' +
        tablename.replaceAll('"', '""') +
        '" t ORDER BY row_to_json(t)::text',
    );
  return rows;
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
function actualHeadings(html: string) {
  const root: Root = unified().use(rehypeParse, { fragment: true }).parse(html);
  const headings: string[] = [];
  visit(root, "element", (node) => {
    if (node.tagName !== "h1") return;
    const parts: string[] = [];
    visit(node, "text", (text) => {
      parts.push(text.value);
    });
    headings.push(parts.join(""));
  });
  return headings;
}
function decodedNodes(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.nodes))
    throw new Error("Expected actual public author page data");
  const nodes: Record<string, unknown>[] = [];
  for (const node of value.nodes) {
    if (!isRecord(node) || !Array.isArray(node.data)) continue;
    const decoded: unknown = unflatten(node.data);
    if (!isRecord(decoded))
      throw new Error("Expected a decoded author page node");
    nodes.push(decoded);
  }
  return nodes;
}
function shanghaiDate(value: string) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

for (const locale of ["en-us", "zh-cn"] as const) {
  test(`demo public authors share all discussions and isolate real namesakes ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const english = locale === "en-us";
      const db = isolatedWorker.database.owner;
      const actor = await isolatedWorker.createActor();
      const realName = `Real namesake ${crypto.randomUUID()}`;
      await db.user.update({
        where: { id: actor.id },
        data: { username: "sample-qiu", name: realName },
      });
      const ordinaryCookie = `${actor.cookie.name}=${actor.cookie.value}; NEXT_LOCALE=${locale}`;
      const ordinaryViewer = await request.get("/_internal/shell-bootstrap", {
        headers: { cookie: ordinaryCookie },
      });
      expect(ordinaryViewer.status()).toBe(200);
      expect(await ordinaryViewer.json()).toMatchObject({
        viewer: { id: actor.id, name: realName, username: "sample-qiu" },
      });
      for (const identifier of ["sample-qiu", actor.id]) {
        const response = await request.get(
          `/api/community/users/${identifier}`,
          { headers: { cookie: ordinaryCookie } },
        );
        expect(response.status()).toBe(200);
        const raw: unknown = await response.json();
        const profile = publicUserProfileResponseSchema.parse(raw);
        expect(profile).toEqual(raw);
        expect(profile.user).toMatchObject({
          id: actor.id,
          name: realName,
          username: "sample-qiu",
          _count: { comments: 0, homeworksCreated: 0, uploads: 0 },
        });
        expect(profile.totalContributions).toBe(0);
      }
      const ordinaryPage = await request.get("/community/users/sample-qiu", {
        headers: { cookie: ordinaryCookie },
      });
      expect(ordinaryPage.status()).toBe(200);
      expect(actualHeadings(await ordinaryPage.text())).toContain(realName);
      const before = await snapshot(isolatedWorker);
      const now = Math.floor(Date.now() / 1000);
      const signed = await createSignedDemoCookie({ issuedAt: now });
      const expired = await createSignedDemoCookie({ issuedAt: now - 901 });
      const cookie = `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`;
      const secret = { "x-test-storage-secret": "local-test-storage-observer" };
      const id = crypto.randomUUID(),
        probe = `/__test/community-effects?id=${id}`;
      const registration = await request.post(`${probe}&io=1`, {
        headers: secret,
      });
      await registration.body();
      expect(registration.status()).toBe(201);
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
            "x-test-community-probe": id,
            cookie,
            origin: isolatedWorker.origin,
            ...extra,
          },
        });
        await response.body();
        expect(response.status(), `${method} ${path}`).toBe(status);
        privateHeaders(response);
        return response;
      };
      try {
        const bootstrap: unknown = await (
          await read("/_internal/shell-bootstrap")
        ).json();
        expect(bootstrap).toMatchObject({
          viewer: null,
          demo: { referenceNow: "2026-09-24T09:00:00+08:00" },
        });

        // Traverse the actual two sealed discussion stores, including the eleventh reply beyond each preview.
        const comments = new Map<
          string,
          Pick<CommentNode, "id" | "author" | "createdAt">
        >();
        const add = (nodes: CommentNode[]) => {
          for (const node of flatten(nodes)) {
            expect(node).toMatchObject({
              status: "active",
              visibility: "public",
              isAnonymous: false,
              authorHidden: false,
              attachments: [],
              canReply: false,
              canReact: false,
              canEdit: false,
              canDelete: false,
              canModerate: false,
            });
            expect(node.author).toMatchObject({
              image: "/images/icon.png",
              isAdmin: false,
              isGuest: false,
              isUstcVerified: false,
            });
            if (
              !["demo-community-xia", "demo-community-qiu"].includes(
                node.author?.id ?? "",
              )
            )
              throw new Error("Unexpected author outside the closed graph");
            const identity = {
              id: node.id,
              author: node.author,
              createdAt: node.createdAt,
            };
            const previous = comments.get(node.id);
            if (previous) expect(identity).toEqual(previous);
            comments.set(node.id, identity);
          }
        };
        for (const [query, roots] of [
          ["targetType=course&targetId=201", 21],
          ["targetType=section&targetId=101", 1],
          ["targetType=teacher&teacherId=401", 1],
          ["targetType=section-teacher&sectionId=101&teacherId=401", 1],
          ["targetType=homework&homeworkId=demo-homework-vectors", 1],
          ["targetType=young-event&youngId=demo-young-1", 21],
          ["targetType=young-event&youngId=demo-young-2", 1],
        ] as const) {
          const dto = commentsListResponseSchema.parse(
            await (
              await read(`/api/community/comments?${query}&pageSize=100`)
            ).json(),
          );
          expect(dto.pagination).toEqual({
            page: 1,
            pageSize: 100,
            total: roots,
            totalPages: 1,
          });
          expect(dto.data).toHaveLength(roots);
          expect(dto.meta.viewer).toMatchObject({
            isAuthenticated: false,
            userId: null,
          });
          add(dto.data);
        }
        for (const id of [
          "demo-comment-course-reply-11",
          "demo-comment-young-reply-11",
        ]) {
          const dto = commentThreadResponseSchema.parse(
            await (await read(`/api/community/comments/${id}`)).json(),
          );
          expect(dto.focusId).toBe(id);
          expect(flatten(dto.thread).map((node) => node.id)).toContain(id);
          expect(dto.viewer).toMatchObject({
            isAuthenticated: false,
            userId: null,
          });
          add(dto.thread);
        }
        const ids = [
          ...Array.from(
            { length: 21 },
            (_, index) =>
              `demo-comment-course-${String(index + 1).padStart(2, "0")}`,
          ),
          ...Array.from(
            { length: 11 },
            (_, index) =>
              `demo-comment-course-reply-${String(index + 1).padStart(2, "0")}`,
          ),
          "demo-comment-section-101",
          "demo-comment-teacher-401",
          "demo-comment-section-teacher-101-401",
          "demo-comment-homework-vectors",
          ...Array.from(
            { length: 21 },
            (_, index) =>
              `demo-comment-young-${String(index + 1).padStart(2, "0")}`,
          ),
          ...Array.from(
            { length: 11 },
            (_, index) =>
              `demo-comment-young-reply-${String(index + 1).padStart(2, "0")}`,
          ),
          "demo-comment-young-second",
        ];
        expect(comments.size).toBe(69);
        expect([...comments.keys()].sort()).toEqual(ids.sort());

        for (const [key, total, dates] of [
          [
            "xia",
            35,
            {
              "2026-09-20": 1,
              "2026-09-21": 10,
              "2026-09-22": 5,
              "2026-09-23": 19,
            },
          ],
          ["qiu", 34, { "2026-09-21": 10, "2026-09-22": 6, "2026-09-23": 18 }],
        ] as const) {
          const authorId = `demo-community-${key}`,
            username = `sample-${key}`;
          const name =
            key === "xia"
              ? english
                ? "Sample student Xia"
                : "样例同学·小夏"
              : english
                ? "Sample student Qiu"
                : "样例同学·小秋";
          const expectedUser = {
            id: authorId,
            username,
            name,
            image: "/images/icon.png",
            createdAt: "2026-09-01T01:00:00.000Z",
            _count: { comments: total, uploads: 0, homeworksCreated: 0 },
          };
          const actualComments = [...comments.values()].filter(
            (node) => node.author?.id === authorId,
          );
          expect(actualComments).toHaveLength(total);
          for (const node of actualComments)
            expect(node.author?.name).toBe(name);
          const actualDays = new Map<string, number>();
          for (const node of actualComments) {
            const day = shanghaiDate(node.createdAt);
            actualDays.set(day, (actualDays.get(day) ?? 0) + 1);
          }
          expect(Object.fromEntries(actualDays)).toEqual(dates);
          const raw: unknown = await (
            await read(`/api/community/users/${username}`)
          ).json();
          const profile = publicUserProfileResponseSchema.parse(raw);
          expect(profile).toEqual(raw);
          expect(profile.user).toEqual(expectedUser);
          expect(profile.totalContributions).toBe(total);
          expect(profile.weeks).toHaveLength(53);
          for (const week of profile.weeks) {
            expect(week).toHaveLength(7);
            expect(new Date(`${week[0].date}T00:00:00Z`).getUTCDay()).toBe(0);
          }
          const cells = profile.weeks.flat();
          expect(cells).toHaveLength(371);
          expect(new Set(cells.map((cell) => cell.date)).size).toBe(371);
          expect(cells.map((cell) => cell.date)).toEqual(
            Array.from({ length: 371 }, (_, index) =>
              new Date(Date.UTC(2025, 8, 21) + index * 86_400_000)
                .toISOString()
                .slice(0, 10),
            ),
          );
          expect(cells[0]).toEqual({ date: "2025-09-21", count: 0 });
          expect(cells.at(-1)).toEqual({ date: "2026-09-26", count: 0 });
          expect(
            cells
              .filter(
                (cell) => cell.date < "2025-09-25" || cell.date > "2026-09-24",
              )
              .every((cell) => cell.count === 0),
          ).toBe(true);
          expect(
            Object.fromEntries(
              cells
                .filter((cell) => cell.count)
                .map((cell) => [cell.date, cell.count]),
            ),
          ).toEqual(dates);
          expect(cells.reduce((sum, cell) => sum + cell.count, 0)).toBe(total);

          for (const alias of [
            username,
            authorId,
            ` SAMPLE-${key.toUpperCase()} `,
          ]) {
            const encoded = encodeURIComponent(alias);
            const api = `/api/community/users/${encoded}`,
              page = `/community/users/${encoded}`,
              data = `${page}/__data.json`;
            const aliasRaw: unknown = await (await read(api)).json();
            expect(publicUserProfileResponseSchema.parse(aliasRaw)).toEqual(
              profile,
            );
            expect(aliasRaw).toEqual(profile);
            const html = await (await read(page)).text();
            expect(actualHeadings(html)).toContain(name);
            expect(html).toContain(
              `href="${isolatedWorker.origin}/community/users/${username}"`,
            );
            for (const privateValue of [actor.id, realName])
              expect(html).not.toContain(privateValue);
            const nodes = decodedNodes(await (await read(data)).json());
            const roots = nodes.filter(
              (node) => typeof node.resolveViewerOnClient === "boolean",
            );
            expect(roots).toHaveLength(1);
            expect(roots[0]).toMatchObject({
              user: null,
              locale,
              demo: { fixtureVersion: "workspace-v1" },
            });
            const authors = nodes.filter(
              (node) => isRecord(node.user) && Array.isArray(node.weeks),
            );
            expect(authors).toHaveLength(1);
            const author = authors[0];
            expect(author).toMatchObject({
              pageDemo: {
                fixtureVersion: "workspace-v1",
                expiresAt: (now + 900) * 1000,
              },
              pageLocale: locale,
            });
            // The leaf stamp must not shadow the root locale used by the owner guard.
            expect(author).not.toHaveProperty("locale");
            const projected = {
              user: author.user,
              weeks: author.weeks,
              totalContributions: author.totalContributions,
            };
            expect(publicUserProfileResponseSchema.parse(projected)).toEqual(
              profile,
            );
            expect(projected).toEqual(profile);
            expect(author.socialMetadata).toMatchObject({
              canonicalUrl: `${isolatedWorker.origin}/community/users/${username}`,
            });
            for (const privateValue of [actor.id, realName])
              expect(JSON.stringify(nodes)).not.toContain(privateValue);
            for (const target of [api, page, data])
              expect(
                await (await read(target, 200, "HEAD")).body(),
              ).toHaveLength(0);
          }
        }
        for (const identifier of [
          actor.id,
          "real-database-user",
          "demo-student",
          "DEMO-COMMUNITY-XIA",
          "__proto__",
        ]) {
          for (const target of [
            `/api/community/users/${identifier}`,
            `/community/users/${identifier}`,
            `/community/users/${identifier}/__data.json`,
          ]) {
            const pageData = target.endsWith("/__data.json");
            const response = await read(target, pageData ? 200 : 404);
            const body = await response.text();
            if (pageData) {
              // SvelteKit transports a load error in a 200 data envelope; the page still has status 404.
              const envelope: unknown = JSON.parse(body);
              if (!isRecord(envelope) || !Array.isArray(envelope.nodes))
                throw new Error("Expected the actual SvelteKit error envelope");
              expect(
                envelope.nodes.filter(
                  (node) => isRecord(node) && node.type === "error",
                ),
              ).toEqual([
                {
                  type: "error",
                  error: {
                    status: 404,
                    message: english ? "User not found" : "未找到用户",
                  },
                },
              ]);
              expect(
                decodedNodes(envelope).filter((node) => isRecord(node.user)),
              ).toEqual([]);
            }
            // A 404 document may echo the requested identifier in its canonical URL; it must not expose the real row.
            expect(body).not.toContain(realName);
          }
        }
        for (const target of [
          "/api/community/users/sample-qiu",
          "/community/users/sample-qiu",
          "/community/users/sample-qiu/__data.json",
        ]) {
          for (const invalid of [
            `${signed.name}=invalid`,
            `${expired.name}=${expired.value}`,
          ])
            await read(target, 401, "GET", {
              cookie: invalid,
              accept: "application/json",
            });
          await read(target, 403, "GET", {
            cookie: `${cookie}; ${actor.cookie.name}=${actor.cookie.value}`,
          });
          for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
            const response = await read(target, 403, method);
            expect(response.headers().location).toBeUndefined();
          }
        }
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
          throw new Error("Expected the complete author request ledger");
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
