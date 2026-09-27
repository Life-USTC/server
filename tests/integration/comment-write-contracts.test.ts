import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { deleteOwnCommentsBatch } from "@/features/comments/server/comment-batch-delete";
import { deleteOwnComment } from "@/features/comments/server/comment-mutations";
import { patchAdminCommentRoute } from "@/lib/api/routes/admin-comment-update-route";
import { patchAdminDescriptionRoute } from "@/lib/api/routes/admin-description-update-route";
import { deleteCommentBatchRoute } from "@/lib/api/routes/comment-batch-route";
import { postCommentReactionRoute } from "@/lib/api/routes/comment-reaction-create-route";
import { deleteCommentReactionRoute } from "@/lib/api/routes/comment-reaction-delete-route";
import { postCommentRoute } from "@/lib/api/routes/comments-create-route";
import { deleteCommentRoute } from "@/lib/api/routes/comments-delete-route";
import { getCommentRoute } from "@/lib/api/routes/comments-thread-route";
import { patchCommentRoute } from "@/lib/api/routes/comments-update-route";
import { postDescriptionRoute } from "@/lib/api/routes/description-upsert-route";
import * as audit from "@/lib/audit/write-audit-log";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { prisma as runtimePrisma, withUserDbContext } from "@/lib/db/prisma";
import { createDeferred } from "../shared/deferred";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const origin = "http://localhost:3000";
const users = ["owner", "other", "admin", "suspended"].map(
  (role) => `${role}-${marker}`,
);
const [owner, other, admin, suspended] = users;
const cookies = new Map<string, string>();
let teacherId: number;
beforeAll(async () => {
  for (const id of users) {
    await db.user.create({
      data: {
        id,
        email: `${id}@example.test`,
        isAdmin: id === admin || id === suspended,
      },
    });
    const token = crypto.randomUUID();
    await db.session.create({
      data: {
        userId: id,
        sessionToken: token,
        expires: new Date(Date.now() + 3600000),
      },
    });
    const context = await getBetterAuthInstance().$context;
    cookies.set(
      id,
      `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${await makeSignature(token, context.secret)}`)}`,
    );
  }
  await db.userSuspension.create({
    data: { userId: suspended, reason: marker },
  });
  teacherId = (
    await db.teacher.create({
      data: { nameCn: marker, jwId: -Math.floor(Math.random() * 1e9) - 1 },
    })
  ).id;
});
afterAll(async () => {
  await db.auditLog.deleteMany({ where: { userId: { in: users } } });
  await db.teacher.deleteMany({ where: { id: teacherId } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
function request(
  body: unknown,
  method = "POST",
  userId: string | null = owner,
) {
  return new Request(`${origin}/api/community/comments?type=heart`, {
    method,
    headers: {
      ...(userId ? { cookie: cookies.get(userId) ?? "" } : {}),
      origin,
      "content-type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
function createInput(extra: Record<string, unknown> = {}) {
  return { targetType: "teacher", teacherId, body: marker, ...extra };
}
async function seed(
  userId = owner,
  status: "active" | "softbanned" | "deleted" = "active",
) {
  return (
    await db.comment.create({
      data: { teacherId, userId, body: marker, status },
    })
  ).id;
}
async function upload(userId = owner) {
  return (
    await db.upload.create({
      data: {
        userId,
        key: crypto.randomUUID(),
        filename: "contract.txt",
        size: 10,
      },
    })
  ).id;
}

it("comment.attachment-ownership", async () => {
  const own = await upload();
  const otherUpload = await upload(other);
  const occupied = await upload();
  const existing = await seed();
  await db.commentAttachment.create({
    data: { commentId: existing, uploadId: occupied },
  });
  const invalidIds = [`missing-${marker}`, otherUpload, occupied];
  for (const id of invalidIds) {
    const response = await postCommentRoute(
      request(createInput({ attachmentIds: [id] })),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid attachments" });
  }
  const created = await postCommentRoute(
    request(createInput({ attachmentIds: [own] })),
  );
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(
    await db.commentAttachment.findMany({
      where: { commentId: id },
      select: { uploadId: true },
    }),
  ).toEqual([{ uploadId: own }]);
  const retained = await patchCommentRoute(
    request({ body: "edited", attachmentIds: [own] }, "PATCH"),
    { id },
  );
  expect(retained.status).toBe(200);
  for (const invalid of invalidIds) {
    const response = await patchCommentRoute(
      request({ body: "must not persist", attachmentIds: [invalid] }, "PATCH"),
      { id },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid attachments" });
  }
  expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
    body: "edited",
  });
  expect(
    await db.commentAttachment.findMany({
      where: { commentId: id },
      select: { uploadId: true },
    }),
  ).toEqual([{ uploadId: own }]);
  const second = await upload();
  expect(
    (
      await patchCommentRoute(
        request({ body: "new attachment", attachmentIds: [second] }, "PATCH"),
        { id },
      )
    ).status,
  ).toBe(200);
  expect(
    await db.commentAttachment.findMany({
      where: { commentId: id },
      select: { uploadId: true },
    }),
  ).toEqual([{ uploadId: second }]);
});

it("comment.batch-delete-limit", async () => {
  const ids: string[] = [];
  for (let i = 0; i < 51; i++) ids.push(await seed());
  for (const invalid of [[], ids, [ids[0], ids[0]], [ids[0], ` ${ids[0]} `]]) {
    const response = await deleteCommentBatchRoute(
      request({ ids: invalid }, "DELETE"),
    );
    expect(response.status).toBe(400);
  }
  expect(
    await db.comment.count({ where: { id: { in: ids }, status: "active" } }),
  ).toBe(51);
  const response = await deleteCommentBatchRoute(
    request({ ids: ids.slice(0, 50) }, "DELETE"),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).results).toEqual(
    ids.slice(0, 50).map((id) => ({ id, success: true })),
  );
  expect(
    await db.comment.count({ where: { id: { in: ids }, status: "deleted" } }),
  ).toBe(50);
});

it("comment.batch-delete-results", async () => {
  const first = await seed();
  const foreign = await seed(other);
  const locked = await seed(owner, "softbanned");
  const last = await seed();
  const missing = `missing-${marker}`;
  const response = await deleteCommentBatchRoute(
    request({ ids: [first, missing, foreign, locked, last] }, "DELETE"),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).results).toEqual([
    { id: first, success: true },
    {
      id: missing,
      success: false,
      error: { code: "not_found", message: "Comment not found" },
    },
    {
      id: foreign,
      success: false,
      error: { code: "forbidden", message: "Forbidden" },
    },
    {
      id: locked,
      success: false,
      error: { code: "locked", message: "Comment locked" },
    },
    { id: last, success: true },
  ]);
  expect(await db.comment.findUnique({ where: { id: foreign } })).toMatchObject(
    { status: "active" },
  );
  expect(await db.comment.findUnique({ where: { id: locked } })).toMatchObject({
    status: "softbanned",
  });
});

it("comment.batch-delete-shared-policy", async () => {
  const single = await seed();
  const batch = await seed();
  const badAudit = { source: "invalid\u0000source" };
  await expect(
    deleteOwnComment({
      userId: owner,
      commentId: single,
      auditMetadata: badAudit,
    }),
  ).rejects.toThrow();
  await expect(
    deleteOwnCommentsBatch({
      userId: owner,
      ids: [batch],
      auditMetadata: badAudit,
    }),
  ).rejects.toThrow();
  expect(
    await db.comment.count({
      where: { id: { in: [single, batch] }, status: "active" },
    }),
  ).toBe(2);
  expect(
    await db.auditLog.count({ where: { targetId: { in: [single, batch] } } }),
  ).toBe(0);
  expect(
    await deleteOwnComment({
      userId: owner,
      commentId: single,
      auditMetadata: { source: "rest" },
    }),
  ).toEqual({ ok: true });
  expect(
    await deleteOwnCommentsBatch({
      userId: owner,
      ids: [batch],
      auditMetadata: { source: "rest" },
    }),
  ).toEqual({ results: [{ id: batch, success: true }] });
  for (const id of [single, batch]) {
    expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
      status: "deleted",
      deletedAt: expect.any(Date),
    });
    const audit = await db.auditLog.findMany({ where: { targetId: id } });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "comment_delete",
      userId: owner,
      metadata: { source: "rest" },
    });
  }
  const forbidden = await seed(other);
  const locked = await seed(owner, "deleted");
  const suspendedOwn = await seed(suspended);
  for (const [id, userId, code] of [
    [forbidden, owner, "forbidden"],
    [locked, owner, "locked"],
    [suspendedOwn, suspended, "suspended"],
  ]) {
    expect(await deleteOwnComment({ userId, commentId: id })).toMatchObject({
      ok: false,
      error: code,
    });
    expect(await deleteOwnCommentsBatch({ userId, ids: [id] })).toMatchObject({
      results: [{ success: false, error: { code } }],
    });
  }
});

it("comment.interaction-gate", async () => {
  const active = await seed();
  for (const viewer of [null, suspended]) {
    const expected = viewer ? 403 : 401;
    const outcomes = [
      await postCommentRoute(request(createInput(), "POST", viewer)),
      await patchCommentRoute(request({ body: "blocked" }, "PATCH", viewer), {
        id: active,
      }),
      await deleteCommentRoute(request(undefined, "DELETE", viewer), {
        id: active,
      }),
      await postCommentRoute(
        request(createInput({ parentId: active }), "POST", viewer),
      ),
      await postCommentReactionRoute(
        request({ type: "heart" }, "POST", viewer),
        { id: active },
      ),
      await deleteCommentReactionRoute(request(undefined, "DELETE", viewer), {
        id: active,
      }),
    ];
    for (const response of outcomes)
      expect(response.status, await response.clone().text()).toBe(expected);
  }
  expect(
    (
      await postCommentRoute(
        request(createInput({ parentId: active }), "POST", other),
      )
    ).status,
  ).toBe(201);
  expect(
    (
      await postCommentReactionRoute(
        request({ type: "heart" }, "POST", other),
        { id: active },
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await patchCommentRoute(request({ body: "not owned" }, "PATCH", other), {
        id: active,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await deleteCommentRoute(request(undefined, "DELETE", other), {
        id: active,
      })
    ).status,
  ).toBe(403);
  for (const status of ["softbanned", "deleted"] as const) {
    const id = await seed(owner, status);
    for (const response of [
      await patchCommentRoute(request({ body: "blocked" }, "PATCH"), { id }),
      await deleteCommentRoute(request(undefined, "DELETE"), { id }),
      await postCommentRoute(request(createInput({ parentId: id }))),
      await postCommentReactionRoute(request({ type: "heart" }), { id }),
      await deleteCommentReactionRoute(request(undefined, "DELETE"), { id }),
    ])
      expect(response.status, await response.clone().text()).toBe(403);
  }
  expect(
    (
      await patchCommentRoute(request({ body: "owner edit" }, "PATCH"), {
        id: active,
      })
    ).status,
  ).toBe(200);
  for (const viewer of [owner, suspended])
    expect(
      (
        await patchAdminCommentRoute(
          request({ status: "softbanned" }, "PATCH", viewer),
          { id: active },
        )
      ).status,
    ).toBe(viewer === suspended ? 403 : 401);
  expect(
    (
      await patchAdminCommentRoute(
        request({ status: "softbanned" }, "PATCH", admin),
        { id: active },
      )
    ).status,
  ).toBe(200);
  expect(await db.comment.findUnique({ where: { id: active } })).toMatchObject({
    body: "owner edit",
    status: "softbanned",
    moderatedById: admin,
  });
});

it("comment.reply-moderation-lock", { timeout: 30000 }, async () => {
  const original = audit.writeAuditLog;
  for (const first of ["moderation", "reply"] as const) {
    const root = await seed();
    const reached = createDeferred<void>();
    const release = createDeferred<void>();
    const spy = vi
      .spyOn(audit, "writeAuditLog")
      .mockImplementation(async (...args) => {
        const result = await original(...args);
        if (
          (first === "moderation" &&
            args[0].action === "admin_comment_moderate" &&
            args[0].targetId === root) ||
          (first === "reply" &&
            args[0].action === "comment_create" &&
            args[0].userId === other)
        ) {
          reached.resolve();
          await release.promise;
        }
        return result;
      });
    const moderate = () =>
      patchAdminCommentRoute(
        request({ status: "softbanned" }, "PATCH", admin),
        { id: root },
      );
    const reply = () =>
      postCommentRoute(request(createInput({ parentId: root }), "POST", other));
    const leading = first === "moderation" ? moderate() : reply();
    let following: Promise<Response> | undefined;
    try {
      await reached.promise;
      following = first === "moderation" ? reply() : moderate();
      await vi.waitFor(
        async () => {
          const [waiting] = await db.$queryRaw<{ count: bigint }[]>`
          SELECT count(*) FROM pg_stat_activity
          WHERE wait_event_type = 'Lock' AND datname = current_database()
            AND usename = 'life_ustc_runtime'
        `;
          expect(Number(waiting.count)).toBeGreaterThan(0);
        },
        { timeout: 5000, interval: 20 },
      );
      release.resolve();
      const [a, b] = await Promise.all([leading, following]);
      if (first === "moderation") {
        expect(a.status).toBe(200);
        expect(b.status, await b.clone().text()).toBe(404);
        expect(await db.comment.count({ where: { parentId: root } })).toBe(0);
      } else {
        expect(a.status, await a.clone().text()).toBe(201);
        expect(b.status).toBe(200);
        expect(
          await db.comment.count({ where: { parentId: root, userId: other } }),
        ).toBe(1);
      }
      expect(
        await db.comment.findUnique({ where: { id: root } }),
      ).toMatchObject({ status: "softbanned" });
    } finally {
      release.resolve();
      await Promise.allSettled([leading, following]);
      spy.mockRestore();
    }
  }
  const root = await seed();
  expect(
    await runtimePrisma.$queryRaw`SELECT * FROM public.lock_comment_reply_parent(${root})`,
  ).toEqual([]);
  for (const userId of [`missing-${marker}`, suspended]) {
    expect(
      await withUserDbContext(
        userId,
        (tx) =>
          tx.$queryRaw`SELECT * FROM public.lock_comment_reply_parent(${root})`,
      ),
    ).toEqual([]);
  }
  const hidden = await seed(owner, "softbanned");
  expect(
    await withUserDbContext(
      other,
      (tx) =>
        tx.$queryRaw`SELECT * FROM public.lock_comment_reply_parent(${hidden})`,
    ),
  ).toEqual([]);
  expect(
    await withUserDbContext(other, (tx) =>
      tx.comment.updateMany({
        where: { id: root },
        data: { body: "forbidden" },
      }),
    ),
  ).toEqual({ count: 0 });
});

it("comment.rich-content", async () => {
  const markdown =
    "**Bold content** 😀\n\n$x^2$\n\n| Header | Value |\n| --- | --- |\n| Row | Cell |";
  const created = await postCommentRoute(
    request(createInput({ body: markdown })),
  );
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(
    (
      await postCommentRoute(
        request(createInput({ parentId: id, body: "A reply" }), "POST", other),
      )
    ).status,
  ).toBe(201);
  expect(
    (
      await postCommentReactionRoute(
        request({ type: "heart" }, "POST", other),
        { id },
      )
    ).status,
  ).toBe(200);
  const response = await getCommentRoute(request(undefined, "GET"), { id });
  expect(response.status).toBe(200);
  const { thread } = await response.json();
  expect(thread[0].body).toBe(markdown);
  expect(thread[0].renderedBody).toContain("<strong>Bold content</strong>");
  expect(thread[0].renderedBody).toContain("😀");
  expect(thread[0].renderedBody).toContain('class="katex"');
  expect(thread[0].renderedBody).toContain("<table>");
  expect(thread[0].replies).toEqual([
    expect.objectContaining({
      body: "A reply",
      renderedBody: "<p>A reply</p>",
    }),
  ]);
  expect(thread[0].reactions).toEqual([
    expect.objectContaining({ type: "heart", count: 1 }),
  ]);
});

it("description.editor-authorization", async () => {
  const body = {
    targetType: "teacher",
    teacherId,
    content: "Collaborative supplement",
  };
  expect((await postDescriptionRoute(request(body, "POST", null))).status).toBe(
    401,
  );
  expect(
    (await postDescriptionRoute(request(body, "POST", suspended))).status,
  ).toBe(403);
  const created = await postDescriptionRoute(request(body));
  expect(created.status, await created.clone().text()).toBe(200);
  const { id } = await created.json();
  const changed = await postDescriptionRoute(
    request({ ...body, content: "Another editor" }, "POST", other),
  );
  expect(changed.status).toBe(200);
  expect(await db.description.findUnique({ where: { id } })).toMatchObject({
    content: "Another editor",
    lastEditedById: other,
  });
  for (const [viewer, expected] of [
    [owner, 401],
    [suspended, 403],
  ] as const) {
    expect(
      (
        await patchAdminDescriptionRoute(
          request({ content: "Blocked" }, "PATCH", viewer),
          { id },
        )
      ).status,
    ).toBe(expected);
  }
  expect(
    (
      await patchAdminDescriptionRoute(
        request({ content: "Moderated" }, "PATCH", admin),
        { id },
      )
    ).status,
  ).toBe(200);
  expect(await db.description.findUnique({ where: { id } })).toMatchObject({
    content: "Moderated",
    lastEditedById: admin,
  });
  expect(
    await db.auditLog.count({
      where: { targetId: id, action: "description_edit" },
    }),
  ).toBe(2);
  expect(
    await db.auditLog.count({
      where: {
        targetId: id,
        action: "admin_description_moderate",
        userId: admin,
      },
    }),
  ).toBe(1);
});
