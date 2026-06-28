/**
 * E2E tests for GET/PATCH/DELETE /api/comments/{id}.
 *
 * ## GET /api/comments/{id}
 * - Returns the full thread rooted at the comment's rootId
 * - Response: { thread: CommentNode[], focusId: string, hiddenCount: number, viewer, target }
 * - target includes resolved section/course/teacher metadata (jwId, code, nameCn, etc.)
 * - Returns 404 if comment does not exist
 * - Returns 403 if the focused comment is hidden from the viewer
 * - Public endpoint (no auth required)
 *
 * ## PATCH /api/comments/{id}
 * - Body: { body, visibility?, isAnonymous?, attachmentIds? }
 * - Response: { success: true, comment: CommentNode }
 * - Auth required (401 if unauthenticated)
 * - Only the owner can update through the public endpoint (403 otherwise)
 * - Admin moderation uses PATCH /api/admin/comments/{id}
 * - Cannot update or delete deleted/softbanned comments (403 "Comment locked")
 *
 * ## DELETE /api/comments/{id}
 * - Response: { success: true }
 * - Auth required (401 if unauthenticated)
 * - Only owner can delete (403 for non-owners, even admins)
 * - Soft-deletes: sets status="deleted" and deletedAt
 * - Returns 404 if comment does not exist
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser, signInAsDevAdmin } from "../../../../../utils/auth";
import { DEV_SEED } from "../../../../../utils/dev-seed";
import { withE2ePrisma } from "../../../../../utils/e2e-db/prisma";
import { createUploadedFileViaApi } from "../../../../../utils/uploads";
import { assertApiContract } from "../../../_shared/api-contract";

/** Resolve the seed section's internal DB id via match-codes. */
async function resolveSeedSectionId(
  request: import("@playwright/test").APIRequestContext,
) {
  const response = await request.post("/api/sections/match-codes", {
    data: { codes: [DEV_SEED.section.code] },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    sections?: Array<{ id?: number; code?: string | null }>;
  };
  const section = body.sections?.find((s) => s.code === DEV_SEED.section.code);
  expect(section?.id).toBeDefined();
  // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
  return section!.id!;
}

/** Find the seed root comment by body content. */
async function findSeedCommentId(
  request: import("@playwright/test").APIRequestContext,
  sectionId: number,
) {
  const response = await request.get(
    `/api/comments?targetType=section&targetId=${sectionId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    comments?: Array<{ id?: string; body?: string }>;
  };
  const seed = body.comments?.find((c) =>
    c.body?.includes(DEV_SEED.comments.sectionRootBody),
  );
  expect(seed?.id).toBeTruthy();
  // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
  return seed!.id!;
}

test("/api/comments/[id] 接口契约", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/comments/[id]" });
});

test("/api/comments/[id] GET 返回线程 focus 与 target 元数据", async ({
  request,
}) => {
  const sectionId = await resolveSeedSectionId(request);
  const commentId = await findSeedCommentId(request, sectionId);

  const threadResponse = await request.get(`/api/comments/${commentId}`);
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
  expect(body.target?.sectionJwId).toBe(DEV_SEED.section.jwId);
  expect(body.target?.courseJwId).toBe(DEV_SEED.course.jwId);
  expect(body.target?.courseName).toBe(DEV_SEED.course.nameCn);
  expect(body.thread?.length ?? 0).toBeGreaterThan(0);
  expect(typeof body.hiddenCount).toBe("number");
  expect(body.viewer).toBeDefined();
});

test("/api/comments/[id] GET 不存在的 ID 返回 404", async ({ request }) => {
  const response = await request.get(
    "/api/comments/00000000-0000-0000-0000-000000000000",
  );
  expect(response.status()).toBe(404);
});

test("/api/comments/[id] GET 隐藏聚焦线程返回 403", async ({
  page,
  request,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  const content = `e2e-hidden-focused-comment-${Date.now()}`;
  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: content,
      visibility: "logged_in_only",
    },
  });
  expect(createResponse.status()).toBe(200);
  const commentId = ((await createResponse.json()) as { id?: string }).id;
  expect(commentId).toBeTruthy();
  if (!commentId) {
    throw new Error("Expected created comment id");
  }

  try {
    const response = await request.get(`/api/comments/${commentId}`);
    expect(response.status()).toBe(403);
  } finally {
    await page.request.delete(`/api/comments/${commentId}`);
  }
});

test("/api/comments/[id] PATCH 未登录返回 401", async ({ request }) => {
  const response = await request.patch(
    "/api/comments/00000000-0000-0000-0000-000000000000",
    { data: { body: "should fail" } },
  );
  expect(response.status()).toBe(401);
});

test("/api/comments/[id] DELETE 未登录返回 401", async ({ request }) => {
  const response = await request.delete(
    "/api/comments/00000000-0000-0000-0000-000000000000",
  );
  expect(response.status()).toBe(401);
});

test("/api/comments/[id] PATCH 拒绝匿名可见性", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const content = `e2e-reject-edit-anonymous-visibility-${Date.now()}`;
  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: content,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(200);
  const commentId = ((await createResponse.json()) as { id?: string }).id;
  expect(commentId).toBeTruthy();

  try {
    const response = await page.request.patch(`/api/comments/${commentId}`, {
      data: {
        body: `${content}-edited`,
        visibility: "anonymous",
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid comment update",
    });
  } finally {
    if (commentId) {
      await page.request.delete(`/api/comments/${commentId}`);
    }
  }
});

test("/api/comments/[id] PATCH 可修改评论并 DELETE 清理", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  // Create a disposable comment to PATCH and DELETE
  const content = `e2e-editable-comment-${Date.now()}`;
  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: content,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(200);
  const commentId = ((await createResponse.json()) as { id?: string }).id;
  expect(commentId).toBeTruthy();

  try {
    // PATCH: update body and visibility
    const edited = `${content}-edited`;
    const patchResponse = await page.request.patch(
      `/api/comments/${commentId}`,
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

    // DELETE the comment
    const deleteResponse = await page.request.delete(
      `/api/comments/${commentId}`,
    );
    expect(deleteResponse.status()).toBe(200);
    expect((await deleteResponse.json()) as { success?: boolean }).toEqual({
      success: true,
    });
  } finally {
    // Ensure cleanup even if assertions fail
    if (commentId) {
      await page.request.delete(`/api/comments/${commentId}`);
    }
  }
});

test("/api/comments/[id] PATCH 非所有者管理员被拒绝", async ({ browser }) => {
  const debugContext = await browser.newContext();
  const debugPage = await debugContext.newPage();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await signInAsDebugUser(debugPage, "/");
  const sectionId = await resolveSeedSectionId(debugPage.request);

  const content = `e2e-admin-public-edit-forbidden-${Date.now()}`;
  const createResponse = await debugPage.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: content,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(200);
  const commentId = ((await createResponse.json()) as { id?: string }).id;
  expect(commentId).toBeTruthy();
  if (!commentId) {
    throw new Error("Expected created comment id");
  }

  try {
    await signInAsDevAdmin(adminPage, "/");

    const patchResponse = await adminPage.request.patch(
      `/api/comments/${commentId}`,
      {
        data: { body: `${content}-admin-edited` },
      },
    );
    expect(patchResponse.status()).toBe(403);
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.comment.deleteMany({ where: { id: commentId } }),
    );
    await adminContext.close();
    await debugContext.close();
  }
});

test("/api/comments/[id] PATCH 拒绝绑定到其他评论的上传文件", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const marker = `e2e-upload-edit-reuse-${Date.now()}`;
  const firstContent = `${marker}-first`;
  const secondContent = `${marker}-second`;
  const uploaded = await createUploadedFileViaApi(page.request, {
    filename: `${marker}.txt`,
    contents: "one upload should not move across comments",
  });

  try {
    const firstResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "section",
        targetId: String(sectionId),
        body: firstContent,
        visibility: "public",
        attachmentIds: [uploaded.uploadId],
      },
    });
    expect(firstResponse.status()).toBe(200);

    const secondResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "section",
        targetId: String(sectionId),
        body: secondContent,
        visibility: "public",
      },
    });
    expect(secondResponse.status()).toBe(200);
    const secondCommentId = ((await secondResponse.json()) as { id?: string })
      .id;
    expect(secondCommentId).toBeTruthy();

    const patchResponse = await page.request.patch(
      `/api/comments/${secondCommentId}`,
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
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.comment.deleteMany({
        where: { body: { startsWith: marker } },
      }),
    );
    await page.request.delete(`/api/uploads/${uploaded.uploadId}`);
  }
});

test("/api/comments/[id] PATCH 对失效评论返回 403", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  const content = `e2e-inactive-edit-comment-${Date.now()}`;
  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: content,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(200);
  const commentId = ((await createResponse.json()) as { id?: string }).id;
  expect(commentId).toBeTruthy();
  if (!commentId) {
    throw new Error("Expected created comment id");
  }

  try {
    await withE2ePrisma((prisma) =>
      prisma.comment.update({
        where: { id: commentId },
        data: { status: "softbanned" },
      }),
    );

    const softbannedResponse = await page.request.patch(
      `/api/comments/${commentId}`,
      {
        data: { body: `${content}-edited` },
      },
    );
    expect(softbannedResponse.status()).toBe(403);
    await expect(softbannedResponse.json()).resolves.toEqual({
      error: "Comment locked",
    });

    const softbannedDeleteResponse = await page.request.delete(
      `/api/comments/${commentId}`,
    );
    expect(softbannedDeleteResponse.status()).toBe(403);
    await expect(softbannedDeleteResponse.json()).resolves.toEqual({
      error: "Comment locked",
    });

    await withE2ePrisma((prisma) =>
      prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: new Date(), status: "deleted" },
      }),
    );

    const deletedResponse = await page.request.patch(
      `/api/comments/${commentId}`,
      {
        data: { body: `${content}-edited-deleted` },
      },
    );
    expect(deletedResponse.status()).toBe(403);
    await expect(deletedResponse.json()).resolves.toEqual({
      error: "Comment locked",
    });

    const deletedDeleteResponse = await page.request.delete(
      `/api/comments/${commentId}`,
    );
    expect(deletedDeleteResponse.status()).toBe(403);
    await expect(deletedDeleteResponse.json()).resolves.toEqual({
      error: "Comment locked",
    });
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.comment.deleteMany({ where: { id: commentId } }),
    );
  }
});
