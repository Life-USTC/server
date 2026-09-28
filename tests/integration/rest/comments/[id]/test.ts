import { expect } from "@playwright/test";
import { createUploadedFileViaApi } from "../../../../e2e/utils/uploads";
import { assertApiContract } from "../../_shared/api-contract";
import { test } from "../_fixture";

test.describe.configure({ mode: "parallel" });
test("/api/community/comments/[id] 接口契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/community/comments/[id]",
  });
});

test("/api/community/comments/[id]/replies 接口契约", async ({ request }) => {
  await assertApiContract(request, {
    routePath: "/api/community/comments/[id]/replies",
  });
});

test("/api/community/comments/[id] GET 返回线程 focus 与 target 元数据", async ({
  commentState,
}) => {
  const request = commentState.anonymous;

  const prepared = await commentState.comment();
  const commentId = prepared.id;

  const threadResponse = await request.get(
    `/api/community/comments/${commentId}`,
  );
  expect(threadResponse.status()).toBe(200);
  const body = (await threadResponse.json()) as {
    focusId?: string;
    target?: {
      courseJwId?: number | null;
      courseName?: string | null;
      sectionId?: number;
      sectionJwId?: number;
    };
    thread?: Array<{ id?: string }>;
    hiddenCount?: number;
    viewer?: object;
  };

  expect(body.focusId).toBe(commentId);
  expect(body.target?.sectionJwId).toBe(commentState.section.jwId);
  expect(body.target?.courseJwId).toBe(commentState.course.jwId);
  expect(body.target?.courseName).toBe(commentState.course.nameCn);
  expect(body.thread?.length ?? 0).toBeGreaterThan(0);
  expect(typeof body.hiddenCount).toBe("number");
  expect(body.viewer).toBeDefined();
});

test("/api/community/comments/[id] GET 不存在的 ID 返回 404", async ({
  request,
}) => {
  const response = await request.get(
    "/api/community/comments/00000000-0000-0000-0000-000000000000",
  );
  expect(response.status()).toBe(404);
});

test("/api/community/comments/[id] GET 隐藏聚焦线程返回 404 且不泄露是否存在", async ({
  commentState,
}) => {
  const request = commentState.owner.request;
  const content = "Private logged-in comment";
  const { id: commentId } = await commentState.comment({
    body: content,
    visibility: "logged_in_only",
  });
  const anonymous = commentState.anonymous;
  const response = await anonymous.get(`/api/community/comments/${commentId}`);
  expect(response.status()).toBe(404);
  const missing = await anonymous.get(
    "/api/community/comments/missing-private-comment",
  );
  expect(missing.status()).toBe(404);
  expect(await response.json()).toEqual(await missing.json());
  const ownerView = await request.get(`/api/community/comments/${commentId}`);
  expect(ownerView.status()).toBe(200);
  expect((await ownerView.json()).focusId).toBe(commentId);
  await expect(
    commentState.db.comment.findUnique({
      where: { id: commentId },
      select: { body: true, visibility: true },
    }),
  ).resolves.toEqual({ body: content, visibility: "logged_in_only" });
});

test("/api/community/comments/[id] PATCH 未登录返回 401", async ({
  request,
}) => {
  const response = await request.patch(
    "/api/community/comments/00000000-0000-0000-0000-000000000000",
    { data: { body: "should fail" } },
  );
  expect(response.status()).toBe(401);
});

test("/api/community/comments/[id] DELETE 未登录返回 401", async ({
  request,
}) => {
  const response = await request.delete(
    "/api/community/comments/00000000-0000-0000-0000-000000000000",
  );
  expect(response.status()).toBe(401);
});

test("/api/community/comments/[id] PATCH 拒绝匿名可见性", async ({
  commentState,
}) => {
  const request = commentState.owner.request;

  const content = `e2e-reject-edit-anonymous-visibility-${crypto.randomUUID()}`;
  const before = await commentState.comment({ body: content });
  const commentId = before.id;
  const response = await request.patch(`/api/community/comments/${commentId}`, {
    data: {
      body: `${content}-edited`,
      visibility: "anonymous",
    },
  });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Invalid comment update",
  });
  expect(
    await commentState.db.comment.findUnique({ where: { id: commentId } }),
  ).toEqual(before);
});

test("/api/community/comments/[id] PATCH 可修改评论并 DELETE 清理", async ({
  commentState,
}) => {
  const request = commentState.owner.request;

  // Create a disposable comment to PATCH and DELETE
  const content = `e2e-editable-comment-${crypto.randomUUID()}`;
  const { id: commentId } = await commentState.comment({ body: content });
  const edited = `${content}-edited`;
  const patchResponse = await request.patch(
    `/api/community/comments/${commentId}`,
    {
      data: {
        body: edited,
        visibility: "logged_in_only",
        isAnonymous: false,
        attachmentIds: [],
      },
    },
  );
  expect(patchResponse.status()).toBe(200);
  const patchBody = (await patchResponse.json()) as {
    success?: boolean;
    comment?: { body?: string; visibility?: string };
  };
  expect(patchBody.success).toBe(true);
  expect(patchBody.comment?.body).toBe(edited);
  expect(patchBody.comment?.visibility).toBe("logged_in_only");
  expect(
    await commentState.db.comment.findUnique({
      where: { id: commentId },
      select: { body: true, visibility: true, isAnonymous: true, status: true },
    }),
  ).toEqual({
    body: edited,
    visibility: "logged_in_only",
    isAnonymous: false,
    status: "active",
  });
  const deleteResponse = await request.delete(
    `/api/community/comments/${commentId}`,
  );
  expect(deleteResponse.status()).toBe(200);
  expect((await deleteResponse.json()) as { success?: boolean }).toEqual({
    success: true,
  });
  expect(
    await commentState.db.comment.findUnique({
      where: { id: commentId },
      select: { status: true, deletedAt: true },
    }),
  ).toEqual({ status: "deleted", deletedAt: expect.any(Date) });
});

test("/api/community/comments/[id] PATCH 非所有者管理员被拒绝", async ({
  commentState,
}) => {
  const adminContext = (await commentState.admin()).request;

  const content = `e2e-admin-public-edit-forbidden-${crypto.randomUUID()}`;
  const before = await commentState.comment({ body: content });
  const commentId = before.id;
  const patchResponse = await adminContext.patch(
    `/api/community/comments/${commentId}`,
    {
      data: { body: `${content}-admin-edited` },
    },
  );
  expect(patchResponse.status()).toBe(403);
  expect(
    await commentState.db.comment.findUnique({ where: { id: commentId } }),
  ).toEqual(before);
});

test("/api/community/comments/[id] PATCH 拒绝绑定到其他评论的上传文件", async ({
  commentState,
}) => {
  const request = commentState.owner.request;

  const marker = `e2e-upload-edit-reuse-${crypto.randomUUID()}`;
  const firstContent = `${marker}-first`;
  const secondContent = `${marker}-second`;
  const uploaded = await createUploadedFileViaApi(request, {
    filename: `${marker}.txt`,
    contents: "one upload should not move across comments",
  });

  await commentState.comment({
    body: firstContent,
    attachments: { create: { uploadId: uploaded.uploadId } },
  });
  const { id: secondCommentId } = await commentState.comment({
    body: secondContent,
  });
  const before = await commentState.db.comment.findMany({
    where: { sectionId: commentState.section.id },
    orderBy: { id: "asc" },
    include: { attachments: true },
  });
  const patchResponse = await request.patch(
    `/api/community/comments/${secondCommentId}`,
    {
      data: {
        body: `${secondContent}-edited`,
        attachmentIds: [uploaded.uploadId],
      },
    },
  );
  expect(patchResponse.status()).toBe(400);
  await expect(patchResponse.json()).resolves.toEqual({
    error: "Invalid attachments",
  });
  expect(
    await commentState.db.comment.findMany({
      where: { sectionId: commentState.section.id },
      orderBy: { id: "asc" },
      include: { attachments: true },
    }),
  ).toEqual(before);
  const object = await commentState.bucket.get(uploaded.key);
  expect(object).not.toBeNull();
  expect(Buffer.from(object?.body ?? []).toString()).toBe(
    "one upload should not move across comments",
  );
});

for (const status of ["deleted", "softbanned"] as const)
  test.describe(status, () => {
    test("/api/community/comments/[id] PATCH 对失效评论返回 403", async ({
      commentState,
    }) => {
      const request = commentState.owner.request;
      const root = await commentState.comment({
        body: "Locked comment",
        status,
        deletedAt:
          status === "deleted" ? new Date("2026-01-02T00:00:00Z") : null,
      });
      const before = await commentState.db.comment.findUniqueOrThrow({
        where: { id: root.id },
      });

      for (const method of ["patch", "delete"] as const) {
        const response = await request[method](
          `/api/community/comments/${root.id}`,
          method === "patch"
            ? { data: { body: "Must not change" } }
            : undefined,
        );
        expect(response.status()).toBe(403);
        await expect(response.json()).resolves.toEqual({
          error: "Comment locked",
        });
      }

      expect(
        await commentState.db.comment.findUniqueOrThrow({
          where: { id: root.id },
        }),
      ).toEqual(before);
    });
  });
