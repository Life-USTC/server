import { expect } from "@playwright/test";
import { test } from "../../_fixture";

test.describe.configure({ mode: "parallel" });

// comment.interaction-gate, comment.locked-action-projection and
// comment.reaction-removal-noop are maintained manually in
// docs/features/comment.yaml. All requests use the real Worker.
test("/api/community/comments/[id]/reactions 接口契约", {
  tag: "@Comment/REST",
}, async ({ run, request }) => {
  await run(async () => {
    const response = await request.get(
      "/api/community/comments/invalid-e2e/reactions",
    );
    expect(response.status()).toBe(405);
  });
});

for (const method of ["POST", "DELETE"] as const) {
  test(`/api/community/comments/[id]/reactions ${method} 未登录返回 401`, {
    tag: "@Comment/REST",
  }, async ({ run, commentState: { anonymous, db, owner, comment } }) => {
    await run(async () => {
      const prepared = await comment();
      for (const commentId of [prepared.id, crypto.randomUUID()]) {
        const path = `/api/community/comments/${commentId}/reactions`;
        const response =
          method === "POST"
            ? await anonymous.post(path, { data: { type: "rocket" } })
            : await anonymous.delete(`${path}?type=rocket`);
        expect(response.status()).toBe(401);
        expect(await response.json()).toEqual({ error: "Unauthorized" });
      }
      expect(
        await db.comment.findUniqueOrThrow({ where: { id: prepared.id } }),
      ).toEqual(prepared);
      expect(
        await db.commentReaction.count({ where: { commentId: prepared.id } }),
      ).toBe(0);
      expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(0);
    });
  });
}

test("/api/community/comments/[id]/reactions concurrent duplicates persist one reaction and audit", {
  tag: "@Comment/REST",
}, async ({ run, commentState: { owner, db, comment } }) => {
  await run(async () => {
    const request = owner.request;
    const prepared = await comment();
    const commentId = prepared.id;
    const createResponses = await Promise.all([
      request.post(`/api/community/comments/${commentId}/reactions`, {
        data: { type: "rocket" },
      }),
      request.post(`/api/community/comments/${commentId}/reactions`, {
        data: { type: "rocket" },
      }),
    ]);
    for (const response of createResponses) {
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ success: true });
    }
    expect(
      await db.commentReaction.findMany({
        where: { commentId },
        select: { userId: true, type: true },
      }),
    ).toEqual([{ userId: owner.id, type: "rocket" }]);
    expect(
      await db.auditLog.count({
        where: { targetId: commentId, action: "comment_react" },
      }),
    ).toBe(1);

    expect(
      await db.comment.findUniqueOrThrow({ where: { id: commentId } }),
    ).toEqual(prepared);
  });
});

test("/api/community/comments/[id]/reactions DELETE removes only the seeded own reaction", {
  tag: "@Comment/REST",
}, async ({ run, commentState: { owner, other, db, comment } }) => {
  await run(async () => {
    const prepared = await comment({
      reactions: {
        create: [
          { userId: owner.id, type: "rocket" },
          { userId: other.id, type: "rocket" },
        ],
      },
    });
    const before = await db.comment.findUniqueOrThrow({
      where: { id: prepared.id },
      include: { reactions: { orderBy: { userId: "asc" } }, attachments: true },
    });
    const response = await owner.request.delete(
      `/api/community/comments/${prepared.id}/reactions?type=rocket`,
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(
      await db.comment.findUniqueOrThrow({
        where: { id: prepared.id },
        include: {
          reactions: { orderBy: { userId: "asc" } },
          attachments: true,
        },
      }),
    ).toEqual({
      ...before,
      reactions: before.reactions.filter((row) => row.userId !== owner.id),
    });
    const audits = await db.auditLog.findMany({
      where: { targetId: prepared.id },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "comment_react",
      userId: owner.id,
      outcome: "success",
    });
  });
});

test("/api/community/comments/[id]/reactions seeded thread exposes count and viewer state", {
  tag: "@Comment/REST",
}, async ({ run, commentState: { owner, db, comment } }) => {
  await run(async () => {
    const prepared = await comment({
      reactions: { create: { userId: owner.id, type: "rocket" } },
    });
    const before = await db.comment.findUniqueOrThrow({
      where: { id: prepared.id },
      include: { reactions: true, attachments: true },
    });
    const response = await owner.request.get(
      `/api/community/comments/${prepared.id}`,
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.focusId).toBe(prepared.id);
    expect(
      body.thread.find((node: { id: string }) => node.id === prepared.id)
        ?.reactions,
    ).toEqual([{ type: "rocket", count: 1, viewerHasReacted: true }]);
    expect(
      await db.comment.findUniqueOrThrow({
        where: { id: prepared.id },
        include: { reactions: true, attachments: true },
      }),
    ).toEqual(before);
    expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(0);
  });
});

test("/api/community/comments/[id]/reactions POST 不存在的评论返回 404", {
  tag: "@Comment/REST",
}, async ({ run, commentState: { owner, db } }) => {
  await run(async () => {
    const commentId = crypto.randomUUID();
    const response = await owner.request.post(
      `/api/community/comments/${commentId}/reactions`,
      { data: { type: "heart" } },
    );
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(
      await db.comment.findUnique({ where: { id: commentId } }),
    ).toBeNull();
    expect(
      await db.commentReaction.count({ where: { userId: owner.id } }),
    ).toBe(0);
    expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(0);
  });
});

for (const status of ["deleted", "softbanned"] as const) {
  for (const method of ["POST", "DELETE"] as const) {
    test(`/api/community/comments/[id]/reactions ${method} 对失效评论返回 403 (${status})`, {
      tag: "@Comment/REST",
    }, async ({ run, commentState: { owner, db, comment } }) => {
      await run(async () => {
        const prepared = await comment({
          status,
          deletedAt:
            status === "deleted" ? new Date("2026-01-02T00:00:00Z") : null,
          ...(method === "DELETE"
            ? {
                reactions: {
                  create: { userId: owner.id, type: "heart" as const },
                },
              }
            : {}),
        });
        const before = await db.comment.findUniqueOrThrow({
          where: { id: prepared.id },
          include: { reactions: true, attachments: true },
        });
        expect(before.reactions).toHaveLength(method === "DELETE" ? 1 : 0);
        const path = `/api/community/comments/${prepared.id}/reactions`;
        const response =
          method === "POST"
            ? await owner.request.post(path, { data: { type: "heart" } })
            : await owner.request.delete(`${path}?type=heart`);
        expect(response.status()).toBe(403);
        expect(await response.json()).toEqual({ error: "Forbidden" });
        expect(
          await db.comment.findUniqueOrThrow({
            where: { id: prepared.id },
            include: { reactions: true, attachments: true },
          }),
        ).toEqual(before);
        expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(
          0,
        );
      });
    });
  }
}

test("/api/community/comments/[id]/reactions suspended actor cannot add or remove reactions", {
  tag: "@Comment/REST",
}, async ({ run, commentState: { owner, other, db, comment } }) => {
  await run(async () => {
    const prepared = await comment();
    await db.commentReaction.create({
      data: { userId: owner.id, commentId: prepared.id, type: "heart" },
    });
    const reason = "Private reaction suspension";
    await db.userSuspension.create({
      data: { userId: owner.id, createdById: other.id, reason },
    });
    const before = await db.comment.findUniqueOrThrow({
      where: { id: prepared.id },
      include: { reactions: true },
    });
    for (const commentId of [prepared.id, crypto.randomUUID()]) {
      for (const method of ["POST", "DELETE"] as const) {
        const path = `/api/community/comments/${commentId}/reactions`;
        const response =
          method === "POST"
            ? await owner.request.post(path, { data: { type: "rocket" } })
            : await owner.request.delete(`${path}?type=heart`);
        expect(response.status()).toBe(403);
        expect(await response.json()).toEqual({ error: "Suspended", reason });
        expect(
          await db.comment.findUniqueOrThrow({
            where: { id: prepared.id },
            include: { reactions: true },
          }),
        ).toEqual(before);
        expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(
          0,
        );
      }
    }
  });
});

test("/api/community/comments/[id]/reactions DELETE missing comment succeeds without effects", {
  tag: "@Comment/REST",
}, async ({ run, commentState: { owner, db } }) => {
  await run(async () => {
    const commentId = crypto.randomUUID();
    const response = await owner.request.delete(
      `/api/community/comments/${commentId}/reactions?type=heart`,
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(
      await db.comment.findUnique({ where: { id: commentId } }),
    ).toBeNull();
    expect(
      await db.commentReaction.count({ where: { userId: owner.id } }),
    ).toBe(0);
    expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(0);
  });
});

test("/api/community/comments/[id]/reactions DELETE absent own reaction is idempotent and preserves another actor", {
  tag: "@Comment/REST",
}, async ({ run, commentState: { owner, other, db, comment } }) => {
  await run(async () => {
    const prepared = await comment();
    await db.commentReaction.create({
      data: { userId: other.id, commentId: prepared.id, type: "heart" },
    });
    const before = await db.comment.findUniqueOrThrow({
      where: { id: prepared.id },
      include: { reactions: true },
    });
    const response = await owner.request.delete(
      `/api/community/comments/${prepared.id}/reactions?type=heart`,
    );
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(
      await db.comment.findUniqueOrThrow({
        where: { id: prepared.id },
        include: { reactions: true },
      }),
    ).toEqual(before);
    expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(0);
  });
});
