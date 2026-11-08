import { createHash } from "node:crypto";
import { type APIRequestContext, expect } from "@playwright/test";
import { unflatten } from "devalue";
import type { CommentNode } from "../../../../src/features/comments/server/comment-types";
import {
  commentRepliesResponseSchema,
  commentsListResponseSchema,
  commentThreadResponseSchema,
} from "../../../../src/lib/api/schemas/comments-response-schemas";
import {
  paginatedYoungEventResponseSchema,
  paginatedYoungOrganizerResponseSchema,
  youngEventDetailSchema,
  youngOrganizerSummarySchema,
} from "../../../../src/lib/api/schemas/young-event-schemas";
import {
  youngEventSubscriptionStateSchema,
  youngOrganizerSubscriptionStateSchema,
} from "../../../../src/lib/api/schemas/young-workspace-schemas";
import { isRecord } from "../../../../src/lib/is-record";
import type { IsolatedWorker } from "../../../e2e/utils/isolated-worker";
import { test } from "../../../e2e/utils/owned-worker";
import { createSignedDemoCookie } from "../../../shared/demo-token";

test.use({ workerBindings: { DEMO_ENABLED: "1", E2E_DEBUG_AUTH: "0" } });
const reference = "2026-09-24T09:00:00+08:00";
const events = "/api/catalog/young-events",
  organizers = "/api/catalog/young-organizers";
const pages = [
  "/catalog/young-events",
  "/catalog/young-events/demo-young-1",
  "/catalog/young-events/calendar",
  "/catalog/young-events/organizers",
  "/catalog/young-events/organizers/demo-young-organizer-1",
];
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
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
type Read = (
  path: string,
  status?: number,
  method?: string,
  extra?: Record<string, string>,
) => ReturnType<APIRequestContext["fetch"]>;
async function observeDemo(
  request: APIRequestContext,
  worker: IsolatedWorker,
  locale: "en-us" | "zh-cn",
  body: (read: Read, cookie: string, expiredCookie: string) => Promise<void>,
) {
  const before = await snapshot(worker);
  const signed = await createSignedDemoCookie({
    issuedAt: Math.floor(Date.now() / 1000),
  });
  const expired = await createSignedDemoCookie({
    issuedAt: Math.floor(Date.now() / 1000) - 901,
  });
  const cookie = `${signed.name}=${signed.value}; NEXT_LOCALE=${locale}`;
  const secret = { "x-test-storage-secret": "local-test-storage-observer" };
  const id = crypto.randomUUID(),
    probe = `/__test/community-effects?id=${id}`;
  const registration = await request.post(`${probe}&io=1`, { headers: secret });
  await registration.body();
  expect(registration.status()).toBe(201);
  const observed: { method: string; path: string }[] = [];
  const read: Read = async (path, status = 200, method = "GET", extra = {}) => {
    observed.push({ method, path: new URL(path, worker.origin).pathname });
    const response = await request.fetch(path, {
      method,
      maxRedirects: 0,
      headers: {
        ...secret,
        "x-test-community-probe": id,
        cookie,
        origin: worker.origin,
        ...extra,
      },
    });
    expect(response.status(), `${method} ${path}`).toBe(status);
    expect(response.headers()).toMatchObject({
      "cache-control": "private, no-store",
      "cloudflare-cdn-cache-control": "no-store",
      vary: "Cookie",
      "x-robots-tag": "noindex, nofollow, noarchive",
    });
    expect(response.headers()["x-life-public-navigation"]).toBeUndefined();
    return response;
  };
  try {
    await body(read, cookie, `${expired.name}=${expired.value}`);
    const response = await request.get(probe, { headers: secret });
    expect(response.status()).toBe(200);
    const effects = await response.json();
    expect(effects).toMatchObject({
      purges: [],
      messages: [],
      backgroundErrors: [],
      io: { bindings: [], outbound: [] },
    });
    for (const entry of observed)
      expect(effects.requests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            outcome: "fulfilled",
            value: expect.objectContaining(entry),
          }),
        ]),
      );
    expect(
      effects.requests.every(
        (entry: { outcome: string }) => entry.outcome === "fulfilled",
      ),
    ).toBe(true);
    expect(await snapshot(worker)).toEqual(before);
  } finally {
    const removed = await request.delete(probe, { headers: secret });
    await removed.body();
    expect(removed.status()).toBe(204);
  }
}

for (const locale of ["en-us", "zh-cn"] as const) {
  test(`demo Young graph, fixed dates and sealed effects ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const db = isolatedWorker.database.owner;
      const actor = await isolatedWorker.createActor();
      const foreignOrganizer = await db.youngOrganizer.create({
        data: {
          name: "Ordinary real organizer",
          normalizedName: `ordinary-${crypto.randomUUID()}`,
        },
      });
      const foreign = await db.youngEvent.create({
        data: {
          youngId: `ordinary-${crypto.randomUUID()}`,
          name: "Ordinary real event sentinel",
          organizerId: foreignOrganizer.id,
          organizer: foreignOrganizer.name,
          isActive: true,
          rawJson: {},
        },
      });
      // Both foreign targets really are publicly readable before Demo isolation is measured.
      for (const [path, expected] of [
        [
          `${events}/${foreign.youngId}`,
          { youngId: foreign.youngId, name: foreign.name },
        ],
        [
          `${organizers}/${foreignOrganizer.id}`,
          { id: foreignOrganizer.id, name: foreignOrganizer.name },
        ],
      ] as const) {
        const ordinary = await request.get(path);
        expect(ordinary.status()).toBe(200);
        expect(await ordinary.json()).toMatchObject(expected);
      }
      await observeDemo(
        request,
        isolatedWorker,
        locale,
        async (read, cookie, expiredCookie) => {
          const bootstrap = await (
            await read("/_internal/shell-bootstrap")
          ).json();
          expect(bootstrap).toMatchObject({
            viewer: null,
            demo: { referenceNow: reference },
          });
          const pageData = async (path: string) => {
            const envelope = await (await read(path)).json();
            if (!isRecord(envelope) || !Array.isArray(envelope.nodes))
              throw new Error("Expected SvelteKit page data nodes");
            const node = envelope.nodes.at(-1);
            if (!isRecord(node) || !Array.isArray(node.data))
              throw new Error("Expected flattened page node data");
            return unflatten(node.data) as {
              demo: { referenceNow: string };
              anchorDate?: string;
              range?: { start: string; end: string };
              subscriptionState?: {
                subscribed: boolean;
                remindSignup?: boolean;
                remindDeadline?: boolean;
                remindStart?: boolean;
              };
              data?: { youngId: string }[];
              pagination?: { total: number };
              demoCalendarItems?: {
                type: string;
                conflictIntervals?: unknown[];
              }[];
            };
          };
          for (const path of pages) {
            const html = await (await read(path)).text();
            expect(html).not.toContain(foreign.name);
            expect(html).not.toContain(actor.id);
            const data = await pageData(`${path}/__data.json`);
            expect(data.demo.referenceNow).toBe(reference);
            if (path.endsWith("/calendar")) {
              expect(data.anchorDate).toBe("2026-09-24");
              expect(data.range).toEqual({
                start: "2026-08-30",
                end: "2026-10-03",
              });
              expect(
                data.demoCalendarItems?.some(
                  (item) =>
                    item.type === "schedule" &&
                    Boolean(item.conflictIntervals?.length),
                ),
              ).toBe(true);
            }
            if (path.endsWith("/demo-young-1"))
              expect(data.subscriptionState).toEqual({
                subscribed: true,
                remindSignup: true,
                remindDeadline: false,
                remindStart: true,
              });
            if (path.endsWith("/demo-young-organizer-1"))
              expect(data.subscriptionState).toEqual({ subscribed: true });
          }
          for (const [query, start, end] of [
            ["view=week&date=2026-09-24", "2026-09-20", "2026-09-26"],
            ["view=day&date=2026-09-24", "2026-09-24", "2026-09-24"],
            ["date=invalid", "2026-08-30", "2026-10-03"],
          ])
            expect(
              (
                await pageData(
                  `/catalog/young-events/calendar/__data.json?${query}`,
                )
              ).range,
            ).toEqual({ start, end });
          const titles =
            locale === "en-us"
              ? [
                  "Fictional algebra discussion",
                  "Fictional physics reading",
                  "Fictional programming workshop",
                  "Fictional study exchange",
                  "Fictional science sketching",
                ]
              : [
                  "虚构代数讨论",
                  "虚构物理共读",
                  "虚构编程工作坊",
                  "虚构学习交流",
                  "虚构科学速写",
                ];
          const home = await (await read("/_internal/home/activities")).json();
          if (!isRecord(home) || !Array.isArray(home.activities))
            throw new Error("Expected Home activities array");
          expect(home.activities).toEqual(
            titles.map((title, index) => ({
              key: `demo-home-activity-${index + 1}`,
              href: `/catalog/young-events/demo-young-${index + 1}`,
              title,
              meta:
                locale === "en-us"
                  ? "Fictional demo sample · Not a public event"
                  : "虚构演示样例 · 非真实公开活动",
              dateLabel: `2026-09-${24 + index}`,
              crossDay: false,
            })),
          );
          const all = [];
          for (const page of [1, 2, 3]) {
            const body = paginatedYoungEventResponseSchema.parse(
              await (await read(`${events}?page=${page}&pageSize=20`)).json(),
            );
            expect(body.pagination).toEqual({
              page,
              pageSize: 20,
              total: 42,
              totalPages: 3,
            });
            expect(body.data).toHaveLength(page === 3 ? 2 : 20);
            expect(body.meta).toEqual({
              unknownDateCount: 0,
              source: { status: "unknown", lastSyncedAt: null },
            });
            expect(JSON.stringify(body)).not.toContain(foreign.name);
            all.push(...body.data);
          }
          expect(new Set(all.map((event) => event.youngId)).size).toBe(42);
          for (const event of all)
            expect(event).not.toHaveProperty("description");
          for (const [basis, ids] of [
            ["activity", ["demo-young-7"]],
            ["registration", ["demo-young-8", "demo-young-13"]],
          ] as const) {
            const body = paginatedYoungEventResponseSchema.parse(
              await (
                await read(`${events}?dateUnknown=true&timeBasis=${basis}`)
              ).json(),
            );
            expect(body.data.map((event) => event.youngId).sort()).toEqual(
              [...ids].sort(),
            );
            expect(body.pagination.total).toBe(ids.length);
          }
          expect(
            youngEventDetailSchema.parse(
              await (await read(`${events}/demo-young-13`)).json(),
            ),
          ).toMatchObject({
            requiresSignup: false,
            applyStartAt: null,
            applyEndAt: null,
          });
          expect(
            youngEventDetailSchema.parse(
              await (await read(`${events}/demo-young-9`)).json(),
            ),
          ).toMatchObject({
            sourceMissing: true,
            isActive: true,
            status: null,
            startAt: "2026-10-02T08:30:00+08:00",
            endAt: "2026-10-03T10:30:00+08:00",
          });
          for (const [basis, count] of [
            ["activity", 1],
            ["registration", 2],
          ] as const) {
            const body = paginatedYoungEventResponseSchema.parse(
              await (
                await read(
                  `${events}?dateFrom=2026-09-24&dateTo=2026-09-24&timeBasis=${basis}`,
                )
              ).json(),
            );
            expect(body.meta.unknownDateCount).toBe(count);
            if (basis === "activity")
              expect(body.data.map((event) => event.youngId)).toContain(
                "demo-young-1",
              );
            else
              expect(body.data.map((event) => event.youngId)).not.toContain(
                "demo-young-6",
              );
          }
          const overlap = paginatedYoungEventResponseSchema.parse(
            await (
              await read(`${events}?dateFrom=2026-10-03&dateTo=2026-10-03`)
            ).json(),
          );
          expect(overlap.data.map((event) => event.youngId)).toContain(
            "demo-young-9",
          );
          expect(
            paginatedYoungEventResponseSchema.parse(
              await (
                await read(
                  `${events}?category=${encodeURIComponent("单次项目,系列项目")}`,
                )
              ).json(),
            ).pagination.total,
          ).toBe(0);
          // Original REST schemas strip unknown keys, unlike News's strict query schema.
          expect(
            paginatedYoungEventResponseSchema.parse(
              await (await read(`${events}?unexpected=ignored`)).json(),
            ).pagination.total,
          ).toBe(42);
          const multi = await pageData(
            "/catalog/young-events/__data.json?category=%E5%8D%95%E6%AC%A1%E9%A1%B9%E7%9B%AE&category=%E7%B3%BB%E5%88%97%E9%A1%B9%E7%9B%AE",
          );
          expect(multi.pagination?.total).toBe(42);
          expect(
            (
              await pageData(
                "/catalog/young-events/__data.json?dateUnknown=true",
              )
            ).data
              ?.map((event) => event.youngId)
              .sort(),
          ).toEqual(["demo-young-13", "demo-young-7", "demo-young-8"]);
          const organizerRows = [];
          for (const page of [1, 2]) {
            const body = paginatedYoungOrganizerResponseSchema.parse(
              await (
                await read(`${organizers}?page=${page}&pageSize=20`)
              ).json(),
            );
            expect(body.pagination).toEqual({
              page,
              pageSize: 20,
              total: 22,
              totalPages: 2,
            });
            expect(body.data).toHaveLength(page === 1 ? 20 : 2);
            organizerRows.push(...body.data);
          }
          expect(new Set(organizerRows.map((row) => row.id)).size).toBe(22);
          expect(
            youngOrganizerSummarySchema.parse(
              await (await read(`${organizers}/demo-young-organizer-1`)).json(),
            ),
          ).toMatchObject({ totalCount: 22, activeCount: 21 });
          expect(
            youngOrganizerSummarySchema.parse(
              await (
                await read(`${organizers}/demo-young-organizer-22`)
              ).json(),
            ),
          ).toMatchObject({
            totalCount: 0,
            activeCount: 0,
            upcomingCount: 0,
            historyCount: 0,
          });
          for (const [page, length] of [
            [1, 20],
            [2, 2],
          ] as const) {
            const body = paginatedYoungEventResponseSchema.parse(
              await (
                await read(
                  `${events}?organizerId=demo-young-organizer-1&page=${page}&pageSize=20`,
                )
              ).json(),
            );
            expect(body.pagination.total).toBe(22);
            expect(body.data).toHaveLength(length);
            expect(
              body.data.every(
                (event) => event.organizerId === "demo-young-organizer-1",
              ),
            ).toBe(true);
          }
          expect(
            paginatedYoungEventResponseSchema.parse(
              await (
                await read(`${events}?organizerId=demo-young-organizer-22`)
              ).json(),
            ),
          ).toMatchObject({
            data: [],
            pagination: { total: 0, totalPages: 1 },
          });
          const imageRedirect = await read(`${events}/demo-young-1/image`, 302);
          const posterPath = `${events}/images/demo-young-poster.png`;
          expect(imageRedirect.headers().location).toBe(posterPath);
          await imageRedirect.body();
          const poster = await read(posterPath),
            bytes = await poster.body();
          expect([...bytes.subarray(0, 8)]).toEqual([
            137, 80, 78, 71, 13, 10, 26, 10,
          ]);
          expect(bytes).toHaveLength(491);
          expect(hash(bytes)).toBe(
            "505fbb5bb6bc582e3ba66d70025196f603b7a40b622fef0976c5c91a7574e707",
          );
          expect(poster.headers()).toMatchObject({
            "content-type": "image/png",
            "x-content-type-options": "nosniff",
            etag: `"${hash(bytes)}"`,
          });
          // Runtime cleanup wraps the body in a stream; framing need not include Content-Length.
          const contentLength = poster.headers()["content-length"];
          if (contentLength !== undefined)
            expect(contentLength).toBe(String(bytes.length));
          expect(
            await (
              await read(posterPath, 304, "GET", {
                "if-none-match": `W/"${hash(bytes)}"`,
              })
            ).body(),
          ).toHaveLength(0);
          for (const [path, status] of [
            [`${events}/${foreign.youngId}`, 404],
            [`${events}/${foreign.youngId}/image`, 404],
            [`${organizers}/${foreignOrganizer.id}`, 404],
            ["/catalog/young-events/unknown", 404],
            ["/catalog/young-events/organizers/unknown", 404],
            [`${events}/images/real-poster.png`, 404],
            [`${events}?dateUnknown=true&dateFrom=2026-09-24`, 400],
            [`${events}?dateFrom=2026-09-25&dateTo=2026-09-24`, 400],
            [`${events}?dateFrom=2025-01-01&dateTo=2026-09-24`, 400],
            [`${events}?pageSize=101`, 400],
            [`${events}?timeBasis=both`, 400],
          ] as const)
            await (await read(path, status)).body();
          expect(
            paginatedYoungEventResponseSchema.parse(
              await (
                await read(`${events}?organizerId=${foreignOrganizer.id}`)
              ).json(),
            ),
          ).toMatchObject({ data: [], pagination: { total: 0 } });
          const targets = [
            ...pages,
            ...pages.map((path) => `${path}/__data.json`),
            events,
            organizers,
            `${events}/demo-young-1`,
            `${organizers}/demo-young-organizer-1`,
            posterPath,
          ];
          for (const path of targets) {
            expect(await (await read(path, 200, "HEAD")).body()).toHaveLength(
              0,
            );
            for (const [identity, status] of [
              [expiredCookie, 401],
              [`${cookie}; ${actor.cookie.name}=${actor.cookie.value}`, 403],
            ] as const)
              await (
                await read(path, status, "GET", { cookie: identity })
              ).body();
            await (await read(path, 403, "POST")).body();
          }
          const eventState = await (
            await read("/api/workspace/young-event-subscriptions/demo-young-1")
          ).json();
          expect(youngEventSubscriptionStateSchema.parse(eventState)).toEqual(
            eventState,
          );
          expect(eventState).toEqual({
            youngId: "demo-young-1",
            subscribed: true,
            remindSignup: true,
            remindDeadline: false,
            remindStart: true,
          });
          const organizerState = await (
            await read(
              "/api/workspace/young-organizer-subscriptions/demo-young-organizer-1",
            )
          ).json();
          expect(
            youngOrganizerSubscriptionStateSchema.parse(organizerState),
          ).toEqual(organizerState);
          expect(organizerState).toEqual({
            organizerId: "demo-young-organizer-1",
            subscribed: true,
          });
          for (const path of [
            "/api/workspace/young-event-subscriptions/demo-young-1",
            "/api/workspace/young-organizer-subscriptions/demo-young-organizer-1",
          ]) {
            expect(await (await read(path, 200, "HEAD")).body()).toHaveLength(
              0,
            );
            for (const method of ["POST", "PUT", "DELETE"])
              await (await read(path, 403, method)).body();
          }
        },
      );
    });
  });

  test(`demo Young discussion target and cursor isolation ${locale}`, {
    tag: "@Account/REST",
  }, async ({ request, isolatedWorker, run }) => {
    await run(async () => {
      const actor = await isolatedWorker.createActor(),
        db = isolatedWorker.database.owner;
      const foreign = await db.youngEvent.create({
        data: {
          youngId: `ordinary-${crypto.randomUUID()}`,
          name: "Ordinary real discussion event",
          isActive: true,
          rawJson: {},
        },
      });
      const rootId = "demo-comment-young-01",
        lastReply = "demo-comment-young-reply-11";
      const real = await db.comment.create({
        data: {
          id: rootId,
          youngEventId: foreign.id,
          userId: actor.id,
          body: "Real private Young discussion sentinel",
          visibility: "logged_in_only",
        },
      });
      const ordinary = await actor.request.get(
        `/api/community/comments?targetType=young-event&youngId=${foreign.youngId}`,
      );
      expect(ordinary.status()).toBe(200);
      const positive = commentsListResponseSchema.parse(await ordinary.json());
      expect(positive.pagination.total).toBe(1);
      expect(positive.data[0]).toMatchObject({
        id: rootId,
        body: real.body,
        author: { id: actor.id },
      });
      await observeDemo(
        request,
        isolatedWorker,
        locale,
        async (read, cookie, expiredCookie) => {
          const base =
            "/api/community/comments?targetType=young-event&youngId=demo-young-1";
          const first = commentsListResponseSchema.parse(
            await (await read(base)).json(),
          );
          expect(first.pagination).toEqual({
            page: 1,
            pageSize: 20,
            total: 21,
            totalPages: 2,
          });
          expect(first.data.map((node) => node.id)).toEqual(
            Array.from(
              { length: 20 },
              (_, i) => `demo-comment-young-${String(i + 1).padStart(2, "0")}`,
            ),
          );
          expect(first.meta).toMatchObject({
            hiddenCount: 0,
            viewer: { userId: null, isAuthenticated: false },
            target: {
              type: "young-event",
              youngId: "demo-young-1",
              youngEventId: 700001,
            },
          });
          for (const node of flatten(first.data)) {
            expect(node.body).not.toContain(real.body);
            expect(node.author?.name).toContain(
              locale === "en-us" ? "Sample student" : "样例同学",
            );
            expect(node.author).toMatchObject({
              isGuest: false,
              isAdmin: false,
              isUstcVerified: false,
              image: "/images/icon.png",
            });
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
            expect(node.reactions).toHaveLength(1);
            expect(node.reactions[0]).toMatchObject({
              type: "upvote",
              viewerHasReacted: false,
            });
            const ordinal = Number(node.id.split("-").at(-1));
            const fixtureIndex = node.id.includes("-reply-")
              ? 20 + ordinal
              : ordinal - 1;
            expect(node.reactions[0].count).toBe(1 + (fixtureIndex % 3));
          }
          const root = first.data[0];
          expect(flatten(root.replies)).toHaveLength(10);
          expect(
            flatten(first.data).some((node) => node.id === lastReply),
          ).toBe(false);
          expect(root.repliesNextCursor).toBeTruthy();
          const continuation = commentRepliesResponseSchema.parse(
            await (
              await read(
                `/api/community/comments/${rootId}/replies?cursor=${encodeURIComponent(root.repliesNextCursor ?? "")}`,
              )
            ).json(),
          );
          expect(continuation.nextCursor).toBeNull();
          expect(flatten(continuation.thread).map((node) => node.id)).toEqual([
            rootId,
            lastReply,
          ]);
          expect(
            commentsListResponseSchema
              .parse(await (await read(`${base}&page=2`)).json())
              .data.map((node) => node.id),
          ).toEqual(["demo-comment-young-21"]);
          expect(
            commentsListResponseSchema
              .parse(
                await (
                  await read(
                    "/api/community/comments?targetType=young-event&youngId=demo-young-2",
                  )
                ).json(),
              )
              .data.map((node) => node.id),
          ).toEqual(["demo-comment-young-second"]);
          expect(
            commentsListResponseSchema.parse(
              await (
                await read(
                  "/api/community/comments?targetType=young-event&youngId=demo-young-3",
                )
              ).json(),
            ),
          ).toMatchObject({ data: [], pagination: { total: 0 } });
          for (const id of [
            lastReply,
            "demo-comment-young-reply-03",
            "demo-comment-young-21",
          ]) {
            const thread = commentThreadResponseSchema.parse(
              await (await read(`/api/community/comments/${id}`)).json(),
            );
            expect(thread.focusId).toBe(id);
            expect(flatten(thread.thread).map((node) => node.id)).toContain(id);
            expect(thread.target).toMatchObject({
              youngId: "demo-young-1",
              youngEventId: 700001,
              youngEventName:
                locale === "en-us"
                  ? "Fictional algebra discussion"
                  : "虚构代数讨论",
            });
            const link = await read(`/community/comments/${id}`, 303);
            expect(link.headers().location).toBe(
              `/catalog/young-events/demo-young-1#comment-${id}`,
            );
            await link.body();
          }
          const encoded = (root.repliesNextCursor ?? "")
            .replaceAll("-", "+")
            .replaceAll("_", "/");
          const valid = JSON.parse(
            atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")),
          ) as {
            rootId: string;
            id: string;
            createdAt: string;
            version: number;
          };
          for (const claims of [
            { ...valid, rootId: "demo-comment-young-second" },
            { ...valid, id: "demo-comment-young-second" },
            { ...valid, id: "demo-comment-course-reply-10" },
            { ...valid, id: "demo-comment-absent" },
            { ...valid, createdAt: "2026-09-24T00:00:00.000Z" },
          ])
            await (
              await read(
                `/api/community/comments/${rootId}/replies?cursor=${encodeURIComponent(btoa(JSON.stringify(claims)))}`,
                400,
              )
            ).body();
          for (const path of [
            `/api/community/comments?targetType=young-event&youngId=${foreign.youngId}`,
            "/api/community/comments?targetType=young-event&targetId=demo-young-1&youngId=demo-young-2",
            "/api/community/comments?targetType=young-event&youngId=demo-young-1&courseJwId=920001",
            "/api/community/comments/demo-comment-young-unknown",
          ])
            await (await read(path, 404)).body();
          for (const path of [
            `/api/community/comments/${rootId}`,
            `/api/community/comments/${rootId}/replies`,
          ]) {
            expect(await (await read(path, 200, "HEAD")).body()).toHaveLength(
              0,
            );
            for (const [identity, status] of [
              [expiredCookie, 401],
              [`${cookie}; ${actor.cookie.name}=${actor.cookie.value}`, 403],
            ] as const)
              await (
                await read(path, status, "GET", { cookie: identity })
              ).body();
          }
          for (const [method, path] of [
            ["POST", "/api/community/comments"],
            ["PATCH", `/api/community/comments/${rootId}`],
            ["DELETE", `/api/community/comments/${rootId}`],
            ["POST", `/api/community/comments/${rootId}/reactions`],
            ["DELETE", `/api/community/comments/${rootId}/reactions`],
          ])
            await (await read(path, 403, method)).body();
        },
      );
    });
  });
}
