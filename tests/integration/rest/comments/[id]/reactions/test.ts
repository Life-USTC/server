import { expect } from "@playwright/test";
import { test } from "../../_fixture";

test.describe.configure({ mode: "parallel" });

// comment.interaction-gate, comment.locked-action-projection and
// comment.reaction-removal-noop are maintained manually in
// docs/features/comment.yaml. All requests use the real Worker.
test("/api/community/comments/[id]/reactions 接口契约", async ({ request }) => {
  const response = await request.get(
    "/api/community/comments/invalid-e2e/reactions",
  );
  expect(response.status()).toBe(405);
});

for (const method of ["POST", "DELETE"] as const) {
  test(`/api/community/comments/[id]/reactions ${method} 未登录返回 401`, async ({
    commentState: { anonymous, db, owner, comment },
  }) => {
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
}

test("/api/community/comments/[id]/reactions 登录后可添加并验证再删除", async ({
  commentState: { owner, db, comment },
}) => {
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

  const threadResponse = await request.get(
    `/api/community/comments/${commentId}`,
  );
  expect(threadResponse.status()).toBe(200);
  const threadBody = (await threadResponse.json()) as {
    thread: Array<{
      id: string;
      reactions: Array<{
        type: string;
        count: number;
        viewerHasReacted: boolean;
      }>;
    }>;
  };
  const focusNode = threadBody.thread.find((node) => node.id === commentId);
  expect(focusNode).toBeDefined();
  expect(focusNode?.reactions).toEqual([
    { type: "rocket", count: 1, viewerHasReacted: true },
  ]);

  const deleteResponse = await request.delete(
    `/api/community/comments/${commentId}/reactions?type=rocket`,
  );
  expect(deleteResponse.status()).toBe(200);
  expect(await deleteResponse.json()).toEqual({ success: true });
  expect(await db.commentReaction.count({ where: { commentId } })).toBe(0);
  expect(
    await db.auditLog.count({
      where: { targetId: commentId, action: "comment_react" },
    }),
  ).toBe(2);
  expect(
    await db.comment.findUniqueOrThrow({ where: { id: commentId } }),
  ).toEqual(prepared);
});

test("/api/community/comments/[id]/reactions POST 不存在的评论返回 404", async ({
  commentState: { owner, db },
}) => {
  const commentId = crypto.randomUUID();
  const response = await owner.request.post(
    `/api/community/comments/${commentId}/reactions`,
    { data: { type: "heart" } },
  );
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({ error: "Not found" });
  expect(await db.comment.findUnique({ where: { id: commentId } })).toBeNull();
  expect(await db.commentReaction.count({ where: { userId: owner.id } })).toBe(
    0,
  );
  expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(0);
});

for (const status of ["deleted", "softbanned"] as const) {
  test(`/api/community/comments/[id]/reactions POST 对失效评论返回 403 (${status})`, async ({
    commentState: { owner, db, section },
  }) => {
    const request = owner.request;
    const createResponse = await request.post("/api/community/comments", {
      data: {
        targetType: "section",
        targetId: String(section.id),
        body: "Private inactive reaction target",
        visibility: "public",
      },
    });
    expect(createResponse.status()).toBe(201);
    const { id: commentId } = (await createResponse.json()) as { id: string };
    expect(commentId).toBeTruthy();
    const before = await db.comment.update({
      where: { id: commentId },
      data: { status, deletedAt: status === "deleted" ? new Date() : null },
      include: { reactions: true },
    });
    const audits = await db.auditLog.findMany({
      where: { userId: owner.id },
      orderBy: { id: "asc" },
    });
    const response = await request.post(
      `/api/community/comments/${commentId}/reactions`,
      { data: { type: "heart" } },
    );
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(
      await db.comment.findUniqueOrThrow({
        where: { id: commentId },
        include: { reactions: true },
      }),
    ).toEqual(before);
    expect(
      await db.auditLog.findMany({
        where: { userId: owner.id },
        orderBy: { id: "asc" },
      }),
    ).toEqual(audits);
  });

  test(`/api/community/comments/[id]/reactions DELETE 对失效评论返回 403 (${status})`, async ({
    commentState: { owner, db, section },
  }) => {
    const request = owner.request;
    const createResponse = await request.post("/api/community/comments", {
      data: {
        targetType: "section",
        targetId: String(section.id),
        body: "Private inactive reaction deletion target",
        visibility: "public",
      },
    });
    expect(createResponse.status()).toBe(201);
    const { id: commentId } = (await createResponse.json()) as { id: string };
    expect(commentId).toBeTruthy();
    const reactionResponse = await request.post(
      `/api/community/comments/${commentId}/reactions`,
      { data: { type: "heart" } },
    );
    expect(reactionResponse.status()).toBe(200);
    expect(await reactionResponse.json()).toEqual({ success: true });
    const before = await db.comment.update({
      where: { id: commentId },
      data: { status, deletedAt: status === "deleted" ? new Date() : null },
      include: { reactions: true },
    });
    expect(before.reactions).toHaveLength(1);
    const audits = await db.auditLog.findMany({
      where: { userId: owner.id },
      orderBy: { id: "asc" },
    });
    const response = await request.delete(
      `/api/community/comments/${commentId}/reactions?type=heart`,
    );
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(
      await db.comment.findUniqueOrThrow({
        where: { id: commentId },
        include: { reactions: true },
      }),
    ).toEqual(before);
    expect(
      await db.auditLog.findMany({
        where: { userId: owner.id },
        orderBy: { id: "asc" },
      }),
    ).toEqual(audits);
  });
}

test("/api/community/comments/[id]/reactions suspended actor cannot add or remove reactions", async ({
  commentState: { owner, other, db, comment },
}) => {
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
      expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(0);
    }
  }
});

test("/api/community/comments/[id]/reactions DELETE missing comment succeeds without effects", async ({
  commentState: { owner, db },
}) => {
  const commentId = crypto.randomUUID();
  const response = await owner.request.delete(
    `/api/community/comments/${commentId}/reactions?type=heart`,
  );
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ success: true });
  expect(await db.comment.findUnique({ where: { id: commentId } })).toBeNull();
  expect(await db.commentReaction.count({ where: { userId: owner.id } })).toBe(
    0,
  );
  expect(await db.auditLog.count({ where: { userId: owner.id } })).toBe(0);
});

test("/api/community/comments/[id]/reactions DELETE absent own reaction is idempotent and preserves another actor", async ({
  commentState: { owner, other, db, comment },
}) => {
  const prepared = await comment();
  await db.commentReaction.create({
    data: { userId: other.id, commentId: prepared.id, type: "heart" },
  });
  const before = await db.comment.findUniqueOrThrow({
    where: { id: prepared.id },
    include: { reactions: true },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
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
  }
});
