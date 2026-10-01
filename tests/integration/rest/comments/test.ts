import { expect } from "@playwright/test";
import { assertCommentThreadFound } from "../../../shared/scenarios/comments";
import { test } from "./_fixture";

test.describe.configure({ mode: "parallel" });
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
      youngId?: string | null;
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
test("/api/community/comments 接口契约", async ({ run, commentState }) => {
  await run(async () => {
    const prepared = await commentState.comment();
    const response = await commentState.anonymous.get(
      `/api/community/comments?targetType=section&targetId=${commentState.section.id}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as CommentListResponse;
    expect(body.data).toEqual([
      expect.objectContaining({ id: prepared.id, body: prepared.body }),
    ]);
    expect(body.pagination?.total).toBe(1);
  });
});

test("/api/community/comments GET 返回 section 目标与已准备的评论", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.anonymous;
    const prepared = await commentState.comment();

    const sectionId = commentState.section.id;

    const response = await request.get(
      `/api/community/comments?targetType=section&targetId=${sectionId}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as CommentListResponse;

    expect(body.meta?.target?.type).toBe("section");
    expect(body.meta?.target?.targetId).toBe(sectionId);
    expect(typeof body.meta?.hiddenCount).toBe("number");
    expect(body.meta?.viewer).toBeDefined();
    expect(body.pagination).toMatchObject({ page: 1, pageSize: 20 });
    expect(body.data?.some((c) => c.body?.includes(prepared.body))).toBe(true);
  });
});

test("/api/community/comments GET 接受公开 section JW id", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.anonymous;
    const prepared = await commentState.comment();

    const response = await request.get(
      `/api/community/comments?targetType=section&sectionJwId=${commentState.section.jwId}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as CommentListResponse;

    expect(body.meta?.target?.type).toBe("section");
    expect(body.meta?.target?.sectionJwId).toBe(commentState.section.jwId);
    expect(body.meta?.target?.courseJwId).toBe(commentState.course.jwId);
    expect(body.meta?.target?.courseName).toBe(commentState.course.nameCn);
    assertCommentThreadFound(body, prepared.body);
  });
});

test("/api/community/comments GET 接受公开 youngId", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.anonymous;

    const response = await request.get(
      `/api/community/comments?targetType=young-event&youngId=${encodeURIComponent(commentState.youngEvent.youngId)}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as CommentListResponse;

    expect(body.meta?.target?.type).toBe("young-event");
    expect(body.meta?.target?.youngId).toBe(commentState.youngEvent.youngId);
  });
});

test("/api/community/comments POST 支持 youngId 目标", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.owner.request;

    const marker = `e2e-young-event-comment-${crypto.randomUUID()}`;
    const response = await request.post("/api/community/comments", {
      data: {
        body: marker,
        targetType: "young-event",
        youngId: commentState.youngEvent.youngId,
      },
    });
    expect(response.status()).toBe(201);
    expect(((await response.json()) as { id?: string }).id).toEqual(
      expect.any(String),
    );
    expect(
      await commentState.db.comment.findMany({
        where: { userId: commentState.owner.id },
        select: { body: true, youngEventId: true },
      }),
    ).toEqual([{ body: marker, youngEventId: commentState.youngEvent.id }]);
  });
});

test("/api/community/comments GET 拒绝未验证的 young-event targetId", async ({
  run,
  request,
}) => {
  await run(async () => {
    const response = await request.get(
      "/api/community/comments?targetType=young-event&targetId=1",
    );
    expect(response.status()).toBe(400);
  });
});

test("/api/community/comments GET 对未知 youngId 返回 404", async ({
  run,
  request,
}) => {
  await run(async () => {
    const response = await request.get(
      "/api/community/comments?targetType=young-event&youngId=missing-young-event",
    );
    expect(response.status()).toBe(404);
  });
});

test("/api/community/comments GET 无效 targetType 返回 400", async ({
  run,
  request,
}) => {
  await run(async () => {
    const response = await request.get(
      "/api/community/comments?targetType=invalid&targetId=1",
    );
    expect(response.status()).toBe(400);
  });
});

test("/api/community/comments GET 不存在的目标返回 404", async ({
  run,
  request,
}) => {
  await run(async () => {
    const response = await request.get(
      "/api/community/comments?targetType=section&targetId=2147483647",
    );
    expect(response.status()).toBe(404);
  });
});

test("/api/community/comments GET 按根评论分页并保留有界回复树", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.anonymous;
    const fixture = { sectionId: commentState.section.id };
    const marker = "private-pagination";
    const rootIds: string[] = [];
    for (let index = 1; index <= 3; index++) {
      const root = await commentState.comment({
        body: `${marker}-root-${index}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
      });
      rootIds.push(root.id);
    }
    await commentState.comment({
      body: `${marker}-reply`,
      parentId: rootIds[0],
      rootId: rootIds[0],
    });
    const firstResponse = await request.get(
      `/api/community/comments?targetType=section&targetId=${fixture.sectionId}&page=1&pageSize=1`,
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
    const secondResponse = await request.get(
      `/api/community/comments?targetType=section&targetId=${fixture.sectionId}&page=2&pageSize=1`,
    );
    expect(secondResponse.status()).toBe(200);
    const second = (await secondResponse.json()) as CommentListResponse;
    expect(second.pagination).toMatchObject({ page: 2, pageSize: 1, total: 3 });
    expect(second.data?.map((comment) => comment.id)).toEqual([rootIds[1]]);
  });
});

test("/api/community/comments GET 限制回复负载并可继续分页", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.anonymous;
    const fixture = { sectionId: commentState.section.id };
    const marker = "private-reply-window";
    const root = await commentState.comment({ body: `${marker}-root` });
    const rootId = root.id;
    const replyIds: string[] = [];
    for (let index = 1; index <= 21; index++) {
      const reply = await commentState.comment({
        body: `${marker}-reply-${index}`,
        parentId: rootId,
        rootId,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
      });
      replyIds.push(reply.id);
    }
    const firstResponse = await request.get(
      `/api/community/comments?targetType=section&targetId=${fixture.sectionId}&pageSize=1`,
    );
    expect(firstResponse.status()).toBe(200);
    const first = (await firstResponse.json()) as {
      data?: Array<{
        id?: string;
        replies?: Array<{
          body?: string;
          id?: string;
          rootId?: string | null;
        }>;
        repliesNextCursor?: string | null;
      }>;
    };
    const firstRoot = first.data?.find((comment) => comment.id === rootId);
    expect(firstRoot?.replies).toHaveLength(10);
    expect(firstRoot?.replies?.map((reply) => reply.body)).toEqual(
      Array.from({ length: 10 }, (_, index) => `${marker}-reply-${index + 1}`),
    );
    expect(firstRoot?.replies?.some((reply) => reply.id === rootId)).toBe(
      false,
    );
    expect(firstRoot?.replies?.every((reply) => reply.rootId === rootId)).toBe(
      true,
    );
    expect(firstRoot?.repliesNextCursor).toEqual(expect.any(String));
    expect(JSON.stringify(first)).not.toContain(`${marker}-reply-11`);
    expect(JSON.stringify(first).length).toBeLessThan(20_000);
    const continuationResponse = await request.get(
      `/api/community/comments/${rootId}/replies?cursor=${encodeURIComponent(firstRoot?.repliesNextCursor ?? "")}&pageSize=20`,
    );
    expect(continuationResponse.status()).toBe(200);
    const continuation = (await continuationResponse.json()) as {
      nextCursor?: string | null;
      rootId?: string;
      thread?: Array<{
        id?: string;
        replies?: Array<{
          body?: string;
          id?: string;
          rootId?: string | null;
        }>;
      }>;
    };
    const continuationRoot = continuation.thread?.find(
      (comment) => comment.id === rootId,
    );
    const firstReplyIds = new Set(
      firstRoot?.replies?.flatMap((reply) => (reply.id ? [reply.id] : [])),
    );
    const continuationReplyIds = continuationRoot?.replies?.flatMap((reply) =>
      reply.id ? [reply.id] : [],
    );
    expect(continuation.rootId).toBe(rootId);
    expect(continuation.nextCursor).toBeNull();
    expect(continuationReplyIds).toHaveLength(11);
    expect(continuationRoot?.replies?.map((reply) => reply.body)).toEqual(
      Array.from({ length: 11 }, (_, index) => `${marker}-reply-${index + 11}`),
    );
    expect(continuationReplyIds?.some((id) => firstReplyIds.has(id))).toBe(
      false,
    );
    expect(
      new Set([...(firstReplyIds ?? []), ...(continuationReplyIds ?? [])]).size,
    ).toBe(replyIds.length);
  });
});

test("/api/community/comments GET section-teacher 空目标不会创建关系行", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.anonymous;

    const fixture = {
      sectionId: commentState.section.id,
      sectionJwId: commentState.section.jwId,
      teacherId: commentState.teacher.id,
    };

    const response = await request.get(
      `/api/community/comments?targetType=section-teacher&sectionId=${fixture.sectionId}&teacherId=${fixture.teacherId}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as CommentListResponse<unknown>;
    expect(body.data).toEqual([]);
    expect(body.pagination?.total).toBe(0);
    expect(body.meta?.target?.sectionId).toBe(fixture.sectionId);
    expect(body.meta?.target?.teacherId).toBe(fixture.teacherId);
    expect(body.meta?.target?.sectionTeacherId).toBeNull();
    const created = await commentState.db.sectionTeacher.findUnique({
      where: {
        sectionId_teacherId: {
          sectionId: fixture.sectionId,
          teacherId: fixture.teacherId,
        },
      },
      select: { id: true },
    });
    expect(created).toBeNull();
  });
});

test("/api/community/comments GET section-teacher 保留 section id 并隔离 retired 关系", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.anonymous;

    const fixture = {
      sectionId: commentState.section.id,
      sectionJwId: commentState.section.jwId,
      teacherId: commentState.teacher.id,
    };
    let sectionTeacherId: number | null = null;

    const active = await commentState.db.sectionTeacher.create({
      data: {
        sectionId: fixture.sectionId,
        teacherId: fixture.teacherId,
      },
      select: { id: true },
    });
    sectionTeacherId = active.id;
    const activeResponse = await request.get(
      `/api/community/comments?targetType=section-teacher&sectionJwId=${fixture.sectionJwId}&teacherId=${fixture.teacherId}`,
    );
    expect(activeResponse.status()).toBe(200);
    const activeBody = (await activeResponse.json()) as CommentListResponse;
    expect(activeBody.meta?.target).toMatchObject({
      sectionId: fixture.sectionId,
      sectionTeacherId,
      teacherId: fixture.teacherId,
    });
    await commentState.db.sectionTeacher.update({
      where: { id: active.id },
      data: { retiredAt: new Date("2026-01-01T00:00:00.000Z") },
    });
    const retiredResponse = await request.get(
      `/api/community/comments?targetType=section-teacher&sectionJwId=${fixture.sectionJwId}&teacherId=${fixture.teacherId}`,
    );
    expect(retiredResponse.status()).toBe(200);
    const retiredBody = (await retiredResponse.json()) as CommentListResponse;
    expect(retiredBody.meta?.target).toMatchObject({
      sectionId: fixture.sectionId,
      sectionTeacherId: null,
      teacherId: fixture.teacherId,
    });
    const directRetiredResponse = await request.get(
      `/api/community/comments?targetType=section-teacher&sectionTeacherId=${active.id}`,
    );
    expect(directRetiredResponse.status()).toBe(404);
  });
});

test("/api/community/comments GET 未关联的 section-teacher 目标返回 404", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.anonymous;
    await commentState.db.section.update({
      where: { id: commentState.section.id },
      data: { teachers: { set: [] } },
    });

    const fixture = {
      sectionId: commentState.section.id,
      sectionJwId: commentState.section.jwId,
      teacherId: commentState.teacher.id,
    };

    const response = await request.get(
      `/api/community/comments?targetType=section-teacher&sectionId=${fixture.sectionId}&teacherId=${fixture.teacherId}`,
    );
    expect(response.status()).toBe(404);
  });
});

test("/api/community/comments POST 未登录返回 401", async ({
  run,
  request,
}) => {
  await run(async () => {
    const response = await request.post("/api/community/comments", {
      data: {
        targetType: "section",
        targetId: "1",
        body: "should fail",
      },
    });
    expect(response.status()).toBe(401);
  });
});

test("/api/community/comments POST 拒绝匿名可见性", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.owner.request;

    const sectionId = commentState.section.id;
    const content = `e2e-reject-anonymous-visibility-${crypto.randomUUID()}`;

    const response = await request.post("/api/community/comments", {
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

    const created = await commentState.db.comment.findFirst({
      where: { body: content, userId: commentState.owner.id },
      select: { id: true },
    });
    expect(created).toBeNull();
  });
});

test("openapi.comment-created-status", async ({ run, commentState }) => {
  await run(async () => {
    const request = commentState.owner.request;

    const sectionId = commentState.section.id;

    const content = `e2e-create-comment-${crypto.randomUUID()}`;
    const createResponse = await request.post("/api/community/comments", {
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
    expect(createResponse.headers().location).toBe(
      `/api/community/comments/${createdId}`,
    );

    const listResponse = await request.get(
      `/api/community/comments?targetType=section&targetId=${sectionId}`,
    );
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as CommentListResponse;
    expect(
      listBody.data?.some((c) => c.id === createdId && c.body === content),
    ).toBe(true);
  });
});

test("/api/community/comments POST 接受公开 section JW id", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.owner.request;

    const content = `e2e-create-comment-section-jwid-${crypto.randomUUID()}`;
    const createResponse = await request.post("/api/community/comments", {
      data: {
        targetType: "section",
        sectionJwId: commentState.section.jwId,
        body: content,
        visibility: "public",
      },
    });
    expect(createResponse.status()).toBe(201);
    const createdId = ((await createResponse.json()) as { id?: string }).id;
    expect(createdId).toBeTruthy();

    const listResponse = await request.get(
      `/api/community/comments?targetType=section&sectionJwId=${commentState.section.jwId}`,
    );
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as CommentListResponse;
    expect(
      listBody.data?.some((c) => c.id === createdId && c.body === content),
    ).toBe(true);
  });
});

test("/api/community/comments POST 拒绝格式错误的公开 section JW id 并回退 targetId", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.owner.request;

    const sectionId = commentState.section.id;
    const content = `e2e-invalid-section-jwid-${crypto.randomUUID()}`;

    const createResponse = await request.post("/api/community/comments", {
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

    const created = await commentState.db.comment.findFirst({
      where: { body: content, userId: commentState.owner.id },
      select: { id: true },
    });
    expect(created).toBeNull();
  });
});

test("/api/community/comments POST 拒绝复用已上传附件", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.owner.request;

    const sectionId = commentState.section.id;
    const marker = `e2e-upload-reuse-${crypto.randomUUID()}`;
    const firstContent = `${marker}-first`;
    const secondContent = `${marker}-second`;
    const uploaded = await commentState.knownUpload({
      filename: `${marker}.txt`,
      contents: "one upload should attach to one comment",
    });

    await commentState.comment({
      body: firstContent,
      attachments: { create: { uploadId: uploaded.id } },
    });
    const before = await commentState.db.comment.findMany({
      where: { sectionId },
      include: { attachments: true },
    });
    const secondResponse = await request.post("/api/community/comments", {
      data: {
        targetType: "section",
        targetId: String(sectionId),
        body: secondContent,
        visibility: "public",
        attachmentIds: [uploaded.id],
      },
    });
    expect(secondResponse.status()).toBe(400);
    await expect(secondResponse.json()).resolves.toEqual({
      error: "Invalid attachments",
    });
    expect(
      await commentState.db.comment.findMany({
        where: { sectionId },
        include: { attachments: true },
      }),
    ).toEqual(before);
    expect(
      await commentState.db.upload.findUnique({ where: { id: uploaded.id } }),
    ).toEqual(uploaded);
    expect(await commentState.db.auditLog.count()).toBe(0);
    const object = await commentState.bucket.get(uploaded.key);
    expect(object).not.toBeNull();
    expect(Buffer.from(object?.body ?? []).toString()).toBe(
      "one upload should attach to one comment",
    );
  });
});

test("/api/community/comments POST 可创建回复评论", async ({
  run,
  commentState,
}) => {
  await run(async () => {
    const request = commentState.owner.request;
    const prepared = await commentState.comment();

    const sectionId = commentState.section.id;

    // Locate this case's independently prepared root.
    const listResponse = await request.get(
      `/api/community/comments?targetType=section&targetId=${sectionId}`,
    );
    expect(listResponse.status()).toBe(200);
    const listBody = (await listResponse.json()) as CommentListResponse;
    expect(listBody.data?.map((comment) => comment.id)).toEqual([prepared.id]);

    const replyContent = `e2e-reply-${crypto.randomUUID()}`;
    const replyResponse = await request.post("/api/community/comments", {
      data: {
        targetType: "section",
        targetId: String(sectionId),
        body: replyContent,
        parentId: prepared.id,
      },
    });
    expect(replyResponse.status()).toBe(201);
    const replyId = ((await replyResponse.json()) as { id?: string }).id;
    expect(replyId).toBeTruthy();

    const threadResponse = await request.get(
      `/api/community/comments/${prepared.id}`,
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
    expect(
      await commentState.db.comment.findUnique({
        where: { id: replyId },
        select: {
          parentId: true,
          rootId: true,
          sectionId: true,
          userId: true,
          body: true,
        },
      }),
    ).toEqual({
      parentId: prepared.id,
      rootId: prepared.id,
      sectionId,
      userId: commentState.owner.id,
      body: replyContent,
    });
  });
});

for (const status of ["deleted", "softbanned"] as const)
  test.describe(status, () => {
    test("/api/community/comments POST 拒绝对失效父评论回复", async ({
      run,
      commentState,
    }) => {
      await run(async () => {
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

        const response = await request.post("/api/community/comments", {
          data: {
            targetType: "section",
            targetId: String(commentState.section.id),
            body: "Must not reply",
            parentId: root.id,
          },
        });
        expect(response.status()).toBe(403);
        expect(
          await commentState.db.comment.count({
            where: { sectionId: commentState.section.id },
          }),
        ).toBe(1);

        expect(
          await commentState.db.comment.findUniqueOrThrow({
            where: { id: root.id },
          }),
        ).toEqual(before);
      });
    });
  });
