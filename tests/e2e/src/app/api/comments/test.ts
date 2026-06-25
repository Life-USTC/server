/**
 * E2E tests for GET /api/comments and POST /api/comments.
 *
 * ## GET /api/comments
 * - Query: targetType (section|course|teacher|homework|section-teacher), targetId, sectionId, sectionJwId, courseJwId, teacherId, homeworkId, sectionTeacherId
 * - Response: { comments: CommentNode[], hiddenCount: number, viewer: ViewerContext, target: {...} }
 * - Public endpoint (no auth required)
 * - Returns 400 for missing/invalid target
 * - Returns 404 for missing target entity
 *
 * ## POST /api/comments
 * - Body: { targetType, targetId, body, visibility?, isAnonymous?, parentId?, attachmentIds?, sectionId?, teacherId? }
 * - Response: { id: string }
 * - Auth required (401 if unauthenticated)
 * - Returns 403 if user is suspended
 * - Validates parentId exists and matches target; sets rootId for threading
 *
 * ## Edge cases
 * - Invalid targetType → 400
 * - Missing targetId for numeric target types → 400
 * - parentId with non-existent parent → 404
 * - parentId with target mismatch → 400
 */
import { expect, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createUploadedFileViaApi } from "../../../../utils/uploads";
import { assertApiContract } from "../../_shared/api-contract";

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

test("/api/comments", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/comments" });
});

test("/api/comments GET 返回 section 目标与 seed 评论", async ({ request }) => {
  const sectionId = await resolveSeedSectionId(request);

  const response = await request.get(
    `/api/comments?targetType=section&targetId=${sectionId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    target?: { type?: string; targetId?: number };
    comments?: Array<{ id?: string; body?: string }>;
    viewer?: { userId?: string | null };
    hiddenCount?: number;
  };

  expect(body.target?.type).toBe("section");
  expect(body.target?.targetId).toBe(sectionId);
  expect(typeof body.hiddenCount).toBe("number");
  expect(body.viewer).toBeDefined();
  expect(
    body.comments?.some((c) =>
      c.body?.includes(DEV_SEED.comments.sectionRootBody),
    ),
  ).toBe(true);
});

test("/api/comments GET accepts public section JW id", async ({ request }) => {
  const response = await request.get(
    `/api/comments?targetType=section&sectionJwId=${DEV_SEED.section.jwId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as {
    target?: {
      courseJwId?: number | null;
      courseName?: string | null;
      type?: string;
      sectionJwId?: number | null;
    };
    comments?: Array<{ body?: string }>;
  };

  expect(body.target?.type).toBe("section");
  expect(body.target?.sectionJwId).toBe(DEV_SEED.section.jwId);
  expect(body.target?.courseJwId).toBe(DEV_SEED.course.jwId);
  expect(body.target?.courseName).toBe(DEV_SEED.course.nameCn);
  expect(
    body.comments?.some((comment) =>
      comment.body?.includes(DEV_SEED.comments.sectionRootBody),
    ),
  ).toBe(true);
});

test("/api/comments GET 无效 targetType 返回 400", async ({ request }) => {
  const response = await request.get(
    "/api/comments?targetType=invalid&targetId=1",
  );
  expect(response.status()).toBe(400);
});

test("/api/comments GET 不存在的目标返回 404", async ({ request }) => {
  const response = await request.get(
    "/api/comments?targetType=section&targetId=2147483647",
  );
  expect(response.status()).toBe(404);
});

test("/api/comments GET section-teacher 空目标不会创建关系行", async ({
  request,
}) => {
  const marker = `[e2e] section-teacher-read-${Date.now()}`;
  const { sectionId, teacherId } = await withE2ePrisma(async (prisma) => {
    const section = await prisma.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
      select: { id: true },
    });
    const teacher = await prisma.teacher.create({
      data: {
        code: marker,
        nameCn: marker,
      },
      select: { id: true },
    });
    await prisma.section.update({
      where: { id: section.id },
      data: { teachers: { connect: { id: teacher.id } } },
    });
    return { sectionId: section.id, teacherId: teacher.id };
  });

  try {
    const response = await request.get(
      `/api/comments?targetType=section-teacher&sectionId=${sectionId}&teacherId=${teacherId}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      comments?: unknown[];
      target?: {
        sectionId?: number | null;
        sectionTeacherId?: number | null;
        teacherId?: number | null;
      };
    };
    expect(body.comments).toEqual([]);
    expect(body.target?.sectionId).toBe(sectionId);
    expect(body.target?.teacherId).toBe(teacherId);
    expect(body.target?.sectionTeacherId).toBeNull();

    const created = await withE2ePrisma((prisma) =>
      prisma.sectionTeacher.findUnique({
        where: {
          sectionId_teacherId: {
            sectionId,
            teacherId,
          },
        },
        select: { id: true },
      }),
    );
    expect(created).toBeNull();
  } finally {
    await withE2ePrisma(async (prisma) => {
      await prisma.sectionTeacher.deleteMany({
        where: { sectionId, teacherId },
      });
      await prisma.section.update({
        where: { id: sectionId },
        data: { teachers: { disconnect: { id: teacherId } } },
      });
      await prisma.teacher.deleteMany({ where: { id: teacherId } });
    });
  }
});

test("/api/comments GET 未关联的 section-teacher 目标返回 404", async ({
  request,
}) => {
  const marker = `[e2e] section-teacher-missing-${Date.now()}`;
  const { sectionId, teacherId } = await withE2ePrisma(async (prisma) => {
    const section = await prisma.section.findUniqueOrThrow({
      where: { jwId: DEV_SEED.section.jwId },
      select: { id: true },
    });
    const teacher = await prisma.teacher.create({
      data: {
        code: marker,
        nameCn: marker,
      },
      select: { id: true },
    });
    return { sectionId: section.id, teacherId: teacher.id };
  });

  try {
    const response = await request.get(
      `/api/comments?targetType=section-teacher&sectionId=${sectionId}&teacherId=${teacherId}`,
    );
    expect(response.status()).toBe(404);
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.teacher.deleteMany({ where: { id: teacherId } }),
    );
  }
});

test("/api/comments POST 未登录返回 401", async ({ request }) => {
  const response = await request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: "1",
      body: "should fail",
    },
  });
  expect(response.status()).toBe(401);
});

test("/api/comments POST 登录后可发布新评论并清理", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  const content = `e2e-create-comment-${Date.now()}`;
  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: content,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(200);
  const createdId = ((await createResponse.json()) as { id?: string }).id;
  expect(createdId).toBeTruthy();

  try {
    const listResponse = await page.request.get(
      `/api/comments?targetType=section&targetId=${sectionId}`,
    );
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as {
      comments?: Array<{ id?: string; body?: string }>;
    };
    expect(
      listBody.comments?.some((c) => c.id === createdId && c.body === content),
    ).toBe(true);
  } finally {
    if (createdId) {
      await page.request.delete(`/api/comments/${createdId}`);
    }
  }
});

test("/api/comments POST rejects reusing an uploaded attachment", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const marker = `e2e-upload-reuse-${Date.now()}`;
  const firstContent = `${marker}-first`;
  const secondContent = `${marker}-second`;
  const uploaded = await createUploadedFileViaApi(page.request, {
    filename: `${marker}.txt`,
    contents: "one upload should attach to one comment",
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
        attachmentIds: [uploaded.uploadId],
      },
    });
    expect(secondResponse.status()).toBe(400);
    await expect(secondResponse.json()).resolves.toEqual({
      error: "Invalid attachments",
    });
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.comment.deleteMany({
        where: { body: { in: [firstContent, secondContent] } },
      }),
    );
    await page.request.delete(`/api/uploads/${uploaded.uploadId}`);
  }
});

test("/api/comments POST 可创建回复评论", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  // Find the seed root comment to reply to
  const listResponse = await page.request.get(
    `/api/comments?targetType=section&targetId=${sectionId}`,
  );
  expect(listResponse.status()).toBe(200);
  const listBody = (await listResponse.json()) as {
    comments?: Array<{ id?: string; body?: string }>;
  };
  const seedComment = listBody.comments?.find((c) =>
    c.body?.includes(DEV_SEED.comments.sectionRootBody),
  );
  expect(seedComment?.id).toBeTruthy();
  // biome-ignore lint/style/noNonNullAssertion: guarded by expect above
  const seedCommentId = seedComment!.id;

  const replyContent = `e2e-reply-${Date.now()}`;
  const replyResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: replyContent,
      parentId: seedCommentId,
    },
  });
  expect(replyResponse.status()).toBe(200);
  const replyId = ((await replyResponse.json()) as { id?: string }).id;
  expect(replyId).toBeTruthy();

  try {
    // Verify the reply appears in the thread
    const threadResponse = await page.request.get(
      `/api/comments/${seedCommentId}`,
    );
    expect(threadResponse.status()).toBe(200);
    const threadBody = (await threadResponse.json()) as {
      thread?: Array<{ replies?: Array<{ id?: string; body?: string }> }>;
    };
    const rootNode = threadBody.thread?.find(
      (n) => n.replies && n.replies.length > 0,
    );
    expect(
      rootNode?.replies?.some(
        (r) => r.id === replyId && r.body === replyContent,
      ),
    ).toBe(true);
  } finally {
    if (replyId) {
      await page.request.delete(`/api/comments/${replyId}`);
    }
  }
});

test("/api/comments POST refuses replies to inactive parent comments", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);

  const content = `e2e-inactive-parent-${Date.now()}`;
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
        data: { deletedAt: new Date(), status: "deleted" },
      }),
    );

    const deletedReplyResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "section",
        targetId: String(sectionId),
        body: `${content}-reply-deleted`,
        parentId: commentId,
      },
    });
    expect(deletedReplyResponse.status()).toBe(403);

    await withE2ePrisma((prisma) =>
      prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: null, status: "softbanned" },
      }),
    );

    const softbannedReplyResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "section",
        targetId: String(sectionId),
        body: `${content}-reply-softbanned`,
        parentId: commentId,
      },
    });
    expect(softbannedReplyResponse.status()).toBe(403);
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.comment.deleteMany({ where: { id: commentId } }),
    );
  }
});
