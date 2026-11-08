import { describe, expect, it } from "vitest";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { resolveDemoCatalogTarget } from "@/features/demo/server/demo-catalog-community";
import {
  getDemoCommunityComment,
  getDemoCommunityPage,
  getDemoCommunityPermalink,
  getDemoCommunityReplies,
} from "@/features/demo/server/demo-community";
import { getDemoCommunityRecords } from "@/features/demo/server/demo-community-fixture";
import {
  getDemoCommentRepliesRoute,
  getDemoCommentRoute,
  getDemoCommentsRoute,
} from "@/lib/api/routes/demo-catalog-read-routes";
import {
  commentRepliesResponseSchema,
  commentsListResponseSchema,
  commentThreadResponseSchema,
} from "@/lib/api/schemas/comments-response-schemas";

const rootId = "demo-comment-course-01";
const lastReply = "demo-comment-course-reply-11";
const request = (query: string) =>
  new Request(`https://life.test/api/community/comments?${query}`);
const flatten = (nodes: CommentNode[]): CommentNode[] =>
  nodes.flatMap((node) => [node, ...flatten(node.replies)]);

describe("fixed demo community", () => {
  for (const locale of ["en-us", "zh-cn"] as const) {
    it(`projects 25 named public roots and 36 fixed nodes in ${locale}`, async () => {
      const records = getDemoCommunityRecords(locale);
      expect(records).toHaveLength(36);
      expect(records.filter(({ comment }) => !comment.parentId)).toHaveLength(
        25,
      );
      for (const id of ["demo-community-xia", "demo-community-qiu"])
        expect(
          records.filter(({ comment }) => comment.userId === id),
        ).toHaveLength(18);
      for (const [query, total] of [
        ["targetType=course&targetId=201", 21],
        ["targetType=section&targetId=101", 1],
        ["targetType=teacher&teacherId=401", 1],
        ["targetType=section-teacher&sectionId=101&teacherId=401", 1],
        ["targetType=homework&homeworkId=demo-homework-vectors", 1],
        ["targetType=course&targetId=202", 0],
      ] as const) {
        const response = getDemoCommentsRoute(request(query), locale);
        expect(response.status).toBe(200);
        const body = commentsListResponseSchema.parse(await response.json());
        expect(body.pagination.total).toBe(total);
        expect(body.meta).toMatchObject({
          hiddenCount: 0,
          viewer: { userId: null, isAuthenticated: false },
        });
        for (const node of flatten(body.data)) {
          expect(node).toMatchObject({
            status: "active",
            visibility: "public",
            isAnonymous: false,
            authorHidden: false,
            isAuthor: false,
            canEdit: false,
            canDelete: false,
            canReply: false,
            canReact: false,
            canModerate: false,
            attachments: [],
          });
          expect(node.author).toMatchObject({
            image: "/images/icon.png",
            isGuest: false,
            isAdmin: false,
            isUstcVerified: false,
          });
          expect(node.author?.name).toContain(
            locale === "en-us" ? "Sample student" : "样例同学",
          );
          expect(node.reactions).toEqual([
            { type: "upvote", count: 3, viewerHasReacted: false },
          ]);
          expect(Date.parse(node.updatedAt)).toBeLessThanOrEqual(
            Date.parse("2026-09-24T09:00:00+08:00"),
          );
        }
      }
      const main = getDemoCommunityComment(rootId, locale)?.thread[0];
      expect(main?.body).toContain(
        locale === "en-us" ? "**linear independence**" : "**线性无关**",
      );
      expect(main?.renderedBody).toContain("<strong>");
      expect(main?.renderedBody).toContain("katex");
      expect(main?.renderedBody).toContain("<table>");
    });
  }

  it("keeps independent root totals, ordered pages and a bounded reply preview", async () => {
    const first = commentsListResponseSchema.parse(
      await getDemoCommentsRoute(
        request("targetType=course&courseJwId=920001"),
        "en-us",
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
    expect(flatten(first.data).some(({ id }) => id === lastReply)).toBe(false);
    expect(first.data[0].repliesNextCursor).toBeTruthy();
    for (const [page, ids] of [
      [2, ["demo-comment-course-21"]],
      [3, []],
    ] as const) {
      const body = await getDemoCommentsRoute(
        request(`targetType=course&targetId=201&page=${page}`),
        "en-us",
      ).json();
      expect(body.data.map(({ id }: { id: string }) => id)).toEqual(ids);
      expect(body.pagination).toEqual({
        page,
        pageSize: 20,
        total: 21,
        totalPages: 2,
      });
    }
    expect(first.data[1].createdAt).toBe(first.data[2].createdAt);
  });

  it("continues the eleventh reply once and focuses beyond both initial bounds", async () => {
    const page = await getDemoCommentsRoute(
      request("targetType=course&targetId=201"),
      "en-us",
    ).json();
    const cursor = page.data[0].repliesNextCursor;
    const response = getDemoCommentRepliesRoute(
      new Request(
        `https://life.test/api/community/comments/${rootId}/replies?${new URLSearchParams({ cursor, pageSize: "20" })}`,
      ),
      rootId,
      "en-us",
    );
    const continuation = commentRepliesResponseSchema.parse(
      await response.json(),
    );
    expect(continuation.rootId).toBe(rootId);
    expect(continuation.nextCursor).toBeNull();
    expect(flatten(continuation.thread).map(({ id }) => id)).toEqual([
      rootId,
      lastReply,
    ]);
    for (const id of [
      lastReply,
      "demo-comment-course-21",
      "demo-comment-course-reply-03",
    ]) {
      const focused = commentThreadResponseSchema.parse(
        await getDemoCommentRoute(id, "en-us").json(),
      );
      expect(focused.focusId).toBe(id);
      expect(flatten(focused.thread).map(({ id }) => id)).toContain(id);
      expect(getDemoCommunityPermalink(id, "en-us")).toBe(
        `/catalog/courses/920001#comment-${id}`,
      );
    }
    const nested = getDemoCommunityComment(
      "demo-comment-course-reply-03",
      "en-us",
    );
    expect(
      flatten(nested?.thread ?? []).find(
        ({ id }) => id === "demo-comment-course-reply-03",
      )?.parentId,
    ).toBe("demo-comment-course-reply-02");
    expect(
      getDemoCommunityPermalink("demo-comment-homework-vectors", "zh-cn"),
    ).toBe(
      "/catalog/sections/910001?homeworkId=demo-homework-vectors#comment-demo-comment-homework-vectors",
    );
  });

  it("fails closed for unknown or mixed targets, invalid cursors and unsupported pagination", () => {
    for (const query of [
      "targetType=course&targetId=201&courseJwId=920002",
      "targetType=section-teacher&sectionId=102&teacherId=402",
    ])
      expect(getDemoCommentsRoute(request(query), "en-us").status).toBe(404);
    expect(
      getDemoCommentsRoute(
        request("targetType=course&targetId=201&pageSize=101"),
        "en-us",
      ).status,
    ).toBe(400);
    expect(getDemoCommentRoute("demo-comment-unknown", "en-us").status).toBe(
      404,
    );
    for (const cursor of [
      "broken",
      btoa(
        JSON.stringify({
          version: 1,
          rootId: "demo-comment-section-101",
          id: "reply",
          createdAt: "2026-09-20T00:00:00Z",
        }),
      ),
      ...[
        ["demo-comment-section-101", "2026-09-23T00:00:00.000Z"],
        ["demo-comment-missing", "2026-09-22T00:09:00.000Z"],
        ["demo-comment-course-reply-10", "2026-09-22T00:08:00.000Z"],
      ].map(([id, createdAt]) =>
        btoa(JSON.stringify({ version: 1, rootId, id, createdAt })),
      ),
    ])
      expect(getDemoCommunityReplies(rootId, "en-us", cursor, 20)).toEqual({
        ok: false,
        error: "invalid_cursor",
      });
    expect(
      getDemoCommunityReplies("demo-comment-unknown", "en-us", undefined, 20),
    ).toEqual({ ok: false, error: "not_found" });
    expect(
      getDemoCommunityPermalink("demo-comment-unknown", "en-us"),
    ).toBeNull();
  });

  it("does not retain mutations to returned comments or author facts", () => {
    const target = resolveDemoCatalogTarget(
      { targetType: "course", targetId: "201" },
      "en-us",
    );
    if (!target) throw new Error("Missing known target");
    const first = getDemoCommunityPage(target, "en-us", 1, 20);
    first.data[0].body = "changed";
    first.data[0].replies.length = 0;
    if (first.data[0].author) first.data[0].author.name = "changed";
    const fresh = getDemoCommunityPage(target, "en-us", 1, 20);
    expect(fresh.data[0].body).toContain("How can we check a basis?");
    expect(fresh.data[0].author?.name).toBe("Sample student Xia");
    expect(flatten(fresh.data[0].replies)).toHaveLength(10);
  });
  for (const locale of ["en-us", "zh-cn"] as const) {
    it(`isolates known Young targets, real root/reply windows and permalinks in ${locale}`, async () => {
      const response = getDemoCommentsRoute(
        request("targetType=young-event&youngId=demo-young-1"),
        locale,
      );
      expect(response.status).toBe(200);
      const first = commentsListResponseSchema.parse(await response.json());
      expect(first.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 21,
        totalPages: 2,
      });
      expect(first.meta.target).toMatchObject({
        type: "young-event",
        youngId: "demo-young-1",
        youngEventId: 700001,
      });
      expect(first.meta.viewer).toMatchObject({
        userId: null,
        isAuthenticated: false,
      });
      expect(first.data.map(({ id }) => id)).toEqual(
        Array.from(
          { length: 20 },
          (_, index) =>
            `demo-comment-young-${String(index + 1).padStart(2, "0")}`,
        ),
      );
      expect(flatten(first.data[0].replies)).toHaveLength(10);
      for (const node of flatten(first.data)) {
        expect(node).toMatchObject({
          isAnonymous: false,
          canReply: false,
          canReact: false,
          canEdit: false,
          canDelete: false,
        });
        expect(node.author?.name).toContain(
          locale === "en-us" ? "Sample student" : "样例同学",
        );
        expect(node.renderedBody).toContain("<strong>");
        expect(node.reactions[0]?.count).toBeGreaterThan(0);
      }
      const second = commentsListResponseSchema.parse(
        await getDemoCommentsRoute(
          request("targetType=young-event&targetId=demo-young-1&page=2"),
          locale,
        ).json(),
      );
      expect(second.data.map(({ id }) => id)).toEqual([
        "demo-comment-young-21",
      ]);
      const continuation = getDemoCommunityReplies(
        "demo-comment-young-01",
        locale,
        first.data[0].repliesNextCursor ?? undefined,
        10,
      );
      expect(continuation.ok).toBe(true);
      if (!continuation.ok) throw new Error("Missing fixed Young continuation");
      expect(continuation.nextCursor).toBeNull();
      expect(flatten(continuation.thread).map(({ id }) => id)).toEqual([
        "demo-comment-young-01",
        "demo-comment-young-reply-11",
      ]);
      const focused = getDemoCommunityComment(
        "demo-comment-young-reply-03",
        locale,
      );
      expect(
        flatten(focused?.thread ?? []).find(
          ({ id }) => id === "demo-comment-young-reply-03",
        )?.parentId,
      ).toBe("demo-comment-young-reply-02");
      expect(
        getDemoCommunityPermalink("demo-comment-young-reply-11", locale),
      ).toBe(
        "/catalog/young-events/demo-young-1#comment-demo-comment-young-reply-11",
      );
      for (const [id, total] of [
        ["demo-young-2", 1],
        ["demo-young-3", 0],
      ] as const) {
        const body = commentsListResponseSchema.parse(
          await getDemoCommentsRoute(
            request(`targetType=young-event&youngId=${id}`),
            locale,
          ).json(),
        );
        expect(body.pagination.total).toBe(total);
        expect(
          flatten(body.data).some(({ id }) =>
            id.startsWith("demo-comment-course"),
          ),
        ).toBe(false);
      }
      for (const query of [
        "targetType=young-event&youngId=real-young-id",
        "targetType=young-event&youngId=demo-young-1&targetId=demo-young-2",
        "targetType=young-event&youngId=demo-young-1&courseJwId=920001",
      ])
        expect(getDemoCommentsRoute(request(query), locale).status).toBe(404);
      const wrongCursor = btoa(
        JSON.stringify({
          version: 1,
          rootId: "demo-comment-young-01",
          id: "demo-comment-young-reply-10",
          createdAt: "2026-09-23T00:00:00.000Z",
        }),
      );
      expect(
        getDemoCommunityReplies(
          "demo-comment-young-01",
          locale,
          wrongCursor,
          10,
        ),
      ).toEqual({ ok: false, error: "invalid_cursor" });
      expect(getDemoCommunityRecords(locale)).toHaveLength(36);
    });
  }
});
