/**
 * E2E tests for GET /api/comments and POST /api/comments.
 *
 * ## GET /api/comments
 * - Query: targetType (section|course|teacher|homework|section-teacher), targetId, sectionId, sectionJwId, courseJwId, teacherId, homeworkId, sectionTeacherId, page, pageSize (deprecated alias: limit)
 * - Response: { data: CommentNode[], pagination, meta: { hiddenCount, viewer, target } }
 * - Public endpoint (no auth required)
 * - Returns 400 for missing/invalid target
 * - Returns 404 for missing target entity
 *
 * ## POST /api/comments
 * - Body: { targetType, targetId, body, visibility?, isAnonymous?, parentId?, attachmentIds?, sectionId?, sectionJwId?, courseJwId?, teacherId?, homeworkId?, sectionTeacherId? }
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
import { expect, type TestInfo, test } from "@playwright/test";
import { signInAsDebugUser } from "../../../../utils/auth";
import { DEV_SEED } from "../../../../utils/dev-seed";
import { withE2ePrisma } from "../../../../utils/e2e-db/prisma";
import { createUploadedFileViaApi } from "../../../../utils/uploads";
import { assertApiContract } from "../../_shared/api-contract";

type DisposableSectionTeacherFixture = {
  courseId: number;
  sectionId: number;
  teacherId: number;
};

type CommentListResponse<TComment = { body?: string; id?: string }> = {
  data?: TComment[];
  meta?: {
    hiddenCount?: number;
    target?: {
      courseJwId?: number | null;
      courseName?: string | null;
      sectionId?: number | null;
      sectionJwId?: number | null;
      sectionTeacherId?: number | null;
      targetId?: number;
      teacherId?: number | null;
      type?: string;
    };
    viewer?: { userId?: string | null };
  };
  pagination?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
};

let disposableFixtureCounter = 0;

function nextDisposableJwId(testInfo: TestInfo) {
  const counter = disposableFixtureCounter;
  disposableFixtureCounter += 1;
  return (
    1_000_000_000 +
    (Date.now() % 10_000_000) * 100 +
    ((testInfo.workerIndex + counter) % 100)
  );
}

async function createDisposableSectionTeacherFixture(
  testInfo: TestInfo,
  options: { connectTeacher: boolean },
): Promise<DisposableSectionTeacherFixture> {
  const courseJwId = nextDisposableJwId(testInfo);
  const sectionJwId = nextDisposableJwId(testInfo);
  const marker = `e2e-section-teacher-${sectionJwId}`;

  return withE2ePrisma((prisma) =>
    prisma.$transaction(async (tx) => {
      const course = await tx.course.create({
        data: {
          code: marker,
          jwId: courseJwId,
          nameCn: marker,
        },
        select: { id: true },
      });
      const teacher = await tx.teacher.create({
        data: {
          code: marker,
          nameCn: marker,
        },
        select: { id: true },
      });
      const section = await tx.section.create({
        data: {
          code: marker,
          courseId: course.id,
          jwId: sectionJwId,
          ...(options.connectTeacher
            ? { teachers: { connect: { id: teacher.id } } }
            : {}),
        },
        select: { id: true },
      });

      return {
        courseId: course.id,
        sectionId: section.id,
        teacherId: teacher.id,
      };
    }),
  );
}

async function deleteDisposableSectionTeacherFixture(
  fixture: DisposableSectionTeacherFixture,
) {
  await withE2ePrisma(async (prisma) => {
    await prisma.section.update({
      where: { id: fixture.sectionId },
      data: { teachers: { set: [] } },
    });
    await prisma.sectionTeacher.deleteMany({
      where: {
        sectionId: fixture.sectionId,
        teacherId: fixture.teacherId,
      },
    });
    await prisma.section.deleteMany({ where: { id: fixture.sectionId } });
    await prisma.teacher.deleteMany({ where: { id: fixture.teacherId } });
    await prisma.course.deleteMany({ where: { id: fixture.courseId } });
  });
}

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

test("/api/comments 接口契约", async ({ request }) => {
  await assertApiContract(request, { routePath: "/api/comments" });
});

test("/api/comments GET 返回 section 目标与 seed 评论", async ({ request }) => {
  const sectionId = await resolveSeedSectionId(request);

  const response = await request.get(
    `/api/comments?targetType=section&targetId=${sectionId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as CommentListResponse;

  expect(body.meta?.target?.type).toBe("section");
  expect(body.meta?.target?.targetId).toBe(sectionId);
  expect(typeof body.meta?.hiddenCount).toBe("number");
  expect(body.meta?.viewer).toBeDefined();
  expect(body.pagination).toMatchObject({ page: 1, pageSize: 20 });
  expect(
    body.data?.some((c) => c.body?.includes(DEV_SEED.comments.sectionRootBody)),
  ).toBe(true);
});

test("/api/comments GET 接受公开 section JW id", async ({ request }) => {
  const response = await request.get(
    `/api/comments?targetType=section&sectionJwId=${DEV_SEED.section.jwId}`,
  );
  expect(response.status()).toBe(200);
  const body = (await response.json()) as CommentListResponse;

  expect(body.meta?.target?.type).toBe("section");
  expect(body.meta?.target?.sectionJwId).toBe(DEV_SEED.section.jwId);
  expect(body.meta?.target?.courseJwId).toBe(DEV_SEED.course.jwId);
  expect(body.meta?.target?.courseName).toBe(DEV_SEED.course.nameCn);
  expect(
    body.data?.some((comment) =>
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

test("/api/comments GET 按根评论分页并保留完整回复树", async ({
  page,
}, testInfo) => {
  await signInAsDebugUser(page, "/");
  const fixture = await createDisposableSectionTeacherFixture(testInfo, {
    connectTeacher: false,
  });
  const marker = `e2e-comment-pagination-${Date.now()}`;
  const rootIds: string[] = [];

  try {
    for (let index = 1; index <= 3; index += 1) {
      const response = await page.request.post("/api/comments", {
        data: {
          targetType: "section",
          targetId: String(fixture.sectionId),
          body: `${marker}-root-${index}`,
        },
      });
      expect(response.status()).toBe(201);
      const id = ((await response.json()) as { id?: string }).id;
      expect(id).toBeTruthy();
      if (id) rootIds.push(id);
    }

    const replyResponse = await page.request.post("/api/comments", {
      data: {
        targetType: "section",
        targetId: String(fixture.sectionId),
        body: `${marker}-reply`,
        parentId: rootIds[0],
      },
    });
    expect(replyResponse.status()).toBe(201);

    const firstResponse = await page.request.get(
      `/api/comments?targetType=section&targetId=${fixture.sectionId}&page=1&pageSize=1`,
    );
    expect(firstResponse.status()).toBe(200);
    const first = (await firstResponse.json()) as CommentListResponse<{
      body?: string;
      id?: string;
      replies?: Array<{ body?: string }>;
    }>;
    expect(first.pagination).toEqual({
      page: 1,
      pageSize: 1,
      total: 3,
      totalPages: 3,
    });
    expect(first.data).toHaveLength(1);
    expect(first.data?.[0]).toMatchObject({
      id: rootIds[0],
      replies: [expect.objectContaining({ body: `${marker}-reply` })],
    });

    const secondResponse = await page.request.get(
      `/api/comments?targetType=section&targetId=${fixture.sectionId}&page=2&limit=1`,
    );
    expect(secondResponse.status()).toBe(200);
    const second = (await secondResponse.json()) as CommentListResponse;
    expect(second.pagination).toMatchObject({ page: 2, pageSize: 1, total: 3 });
    expect(second.data?.map((comment) => comment.id)).toEqual([rootIds[1]]);
  } finally {
    await withE2ePrisma((prisma) =>
      prisma.comment.deleteMany({ where: { sectionId: fixture.sectionId } }),
    );
    await deleteDisposableSectionTeacherFixture(fixture);
  }
});

test("/api/comments GET section-teacher 空目标不会创建关系行", async ({
  request,
}, testInfo) => {
  const fixture = await createDisposableSectionTeacherFixture(testInfo, {
    connectTeacher: true,
  });

  try {
    const response = await request.get(
      `/api/comments?targetType=section-teacher&sectionId=${fixture.sectionId}&teacherId=${fixture.teacherId}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as CommentListResponse<unknown>;
    expect(body.data).toEqual([]);
    expect(body.pagination?.total).toBe(0);
    expect(body.meta?.target?.sectionId).toBe(fixture.sectionId);
    expect(body.meta?.target?.teacherId).toBe(fixture.teacherId);
    expect(body.meta?.target?.sectionTeacherId).toBeNull();

    const created = await withE2ePrisma((prisma) =>
      prisma.sectionTeacher.findUnique({
        where: {
          sectionId_teacherId: {
            sectionId: fixture.sectionId,
            teacherId: fixture.teacherId,
          },
        },
        select: { id: true },
      }),
    );
    expect(created).toBeNull();
  } finally {
    await deleteDisposableSectionTeacherFixture(fixture);
  }
});

test("/api/comments GET 未关联的 section-teacher 目标返回 404", async ({
  request,
}, testInfo) => {
  const fixture = await createDisposableSectionTeacherFixture(testInfo, {
    connectTeacher: false,
  });

  try {
    const response = await request.get(
      `/api/comments?targetType=section-teacher&sectionId=${fixture.sectionId}&teacherId=${fixture.teacherId}`,
    );
    expect(response.status()).toBe(404);
  } finally {
    await deleteDisposableSectionTeacherFixture(fixture);
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

test("/api/comments POST 拒绝匿名可见性", async ({ page }) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const content = `e2e-reject-anonymous-visibility-${Date.now()}`;

  const response = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      body: content,
      visibility: "anonymous",
    },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: "Invalid comment request",
  });

  const created = await withE2ePrisma((prisma) =>
    prisma.comment.findFirst({
      where: { body: content },
      select: { id: true },
    }),
  );
  expect(created).toBeNull();
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
  expect(createResponse.status()).toBe(201);
  const createdId = ((await createResponse.json()) as { id?: string }).id;
  expect(createdId).toBeTruthy();
  expect(createResponse.headers().location).toBe(`/api/comments/${createdId}`);

  try {
    const listResponse = await page.request.get(
      `/api/comments?targetType=section&targetId=${sectionId}`,
    );
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as CommentListResponse;
    expect(
      listBody.data?.some((c) => c.id === createdId && c.body === content),
    ).toBe(true);
  } finally {
    if (createdId) {
      await page.request.delete(`/api/comments/${createdId}`);
    }
  }
});

test("/api/comments POST 接受公开 section JW id", async ({ page }) => {
  await signInAsDebugUser(page, "/");

  const content = `e2e-create-comment-section-jwid-${Date.now()}`;
  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      sectionJwId: DEV_SEED.section.jwId,
      body: content,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(201);
  const createdId = ((await createResponse.json()) as { id?: string }).id;
  expect(createdId).toBeTruthy();

  try {
    const listResponse = await page.request.get(
      `/api/comments?targetType=section&sectionJwId=${DEV_SEED.section.jwId}`,
    );
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as CommentListResponse;
    expect(
      listBody.data?.some((c) => c.id === createdId && c.body === content),
    ).toBe(true);
  } finally {
    if (createdId) {
      await page.request.delete(`/api/comments/${createdId}`);
    }
  }
});

test("/api/comments POST 拒绝格式错误的公开 section JW id 并回退 targetId", async ({
  page,
}) => {
  await signInAsDebugUser(page, "/");
  const sectionId = await resolveSeedSectionId(page.request);
  const content = `e2e-invalid-section-jwid-${Date.now()}`;

  const createResponse = await page.request.post("/api/comments", {
    data: {
      targetType: "section",
      targetId: String(sectionId),
      sectionJwId: "abc",
      body: content,
      visibility: "public",
    },
  });
  expect(createResponse.status()).toBe(400);
  await expect(createResponse.json()).resolves.toEqual({
    error: "Invalid comment request",
  });

  const created = await withE2ePrisma((prisma) =>
    prisma.comment.findFirst({
      where: { body: content },
      select: { id: true },
    }),
  );
  expect(created).toBeNull();
});

test("/api/comments POST 拒绝复用已上传附件", async ({ page }) => {
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
    expect(firstResponse.status()).toBe(201);

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
  const listBody = (await listResponse.json()) as CommentListResponse;
  const seedComment = listBody.data?.find((c) =>
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
  expect(replyResponse.status()).toBe(201);
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

test("/api/comments POST 拒绝对失效父评论回复", async ({ page }) => {
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
  expect(createResponse.status()).toBe(201);
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
