import { expect, vi } from "vitest";
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
import { prisma as runtimePrisma, withUserDbContext } from "@/lib/db/prisma";
import { createDeferred } from "../shared/deferred";
import {
  type DomainState,
  domainStateTest,
} from "../shared/domain-state-fixture";

const origin = "http://localhost:3000";
function commentHelpers(state: DomainState, teacherId: number) {
  const { db, marker, users, cookies } = state;
  const [owner, other, admin, suspended] = users;
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

  return {
    ...state,
    owner,
    other,
    admin,
    suspended,
    teacherId,
    request,
    createInput,
    seed,
    upload,
  };
}
function readCommentState(db: DomainState["db"]) {
  return db.comment.findMany({
    orderBy: { id: "asc" },
    include: {
      attachments: { orderBy: { id: "asc" } },
      reactions: { orderBy: { id: "asc" } },
    },
  });
}

const it = domainStateTest.extend<{
  comment: ReturnType<typeof commentHelpers>;
}>({
  comment: async ({ state }, use) => {
    const { db, marker } = state;
    const teacher = await db.teacher.create({
      data: { nameCn: marker, jwId: 101 },
    });
    await use(commentHelpers(state, teacher.id));
  },
});

for (const operation of ["create", "retain"] as const) {
  it(operation === "create"
    ? "comment.attachment-ownership"
    : "comment attachments retain rejects invalid references and preserves occupied uploads", {
    tags: ["@Comment/REST"],
  }, async ({ comment }) => {
    const { db, marker, owner, other, request, createInput, seed, upload } =
      comment;
    await comment.runtime(async () => {
      const own = await upload();
      const foreign = await upload(other);
      const occupied = await upload();
      const occupiedComment = await seed();
      await db.commentAttachment.create({
        data: { commentId: occupiedComment, uploadId: occupied },
      });
      const target = operation === "retain" ? await seed() : null;
      if (target)
        await db.commentAttachment.create({
          data: { commentId: target, uploadId: own },
        });
      const before = await readCommentState(db);
      const uploads = await db.upload.findMany({ orderBy: { id: "asc" } });
      for (const attachmentId of [`missing-${marker}`, foreign, occupied]) {
        const response = target
          ? await patchCommentRoute(
              request(
                { body: "must not persist", attachmentIds: [attachmentId] },
                "PATCH",
              ),
              { id: target },
            )
          : await postCommentRoute(
              request(createInput({ attachmentIds: [attachmentId] })),
            );
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: "Invalid attachments",
        });
        expect(await readCommentState(db)).toEqual(before);
        expect(await db.upload.findMany({ orderBy: { id: "asc" } })).toEqual(
          uploads,
        );
        expect(await db.auditLog.findMany()).toEqual([]);
      }
      const response = target
        ? await patchCommentRoute(
            request({ body: "edited", attachmentIds: [own] }, "PATCH"),
            { id: target },
          )
        : await postCommentRoute(
            request(createInput({ attachmentIds: [own] })),
          );
      expect(response.status).toBe(target ? 200 : 201);
      const payload = await response.json();
      const id = target ?? payload.id;
      expect(id).toEqual(expect.any(String));
      const after = await readCommentState(db);
      expect(after.filter((row) => row.id !== id)).toEqual(
        before.filter((row) => row.id !== id),
      );
      expect(after.find((row) => row.id === id)).toMatchObject({
        id,
        userId: owner,
        body: target ? "edited" : marker,
        attachments: [expect.objectContaining({ uploadId: own })],
      });
      expect(
        await db.commentAttachment.findMany({
          where: { uploadId: occupied },
          select: { commentId: true },
        }),
      ).toEqual([{ commentId: occupiedComment }]);
      expect(await db.upload.findMany({ orderBy: { id: "asc" } })).toEqual(
        uploads,
      );
    });
  });
}

it("comment attachment replacement starts from a seeded owned link", {
  tags: ["@Comment/REST"],
}, async ({ comment }) => {
  const { db, request, seed, upload } = comment;
  await comment.runtime(async () => {
    const id = await seed();
    const own = await upload();
    const second = await upload();
    await db.commentAttachment.create({
      data: { commentId: id, uploadId: own },
    });
    const uploads = await db.upload.findMany({ orderBy: { id: "asc" } });
    const response = await patchCommentRoute(
      request({ body: "new attachment", attachmentIds: [second] }, "PATCH"),
      { id },
    );
    expect(response.status).toBe(200);
    expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
      body: "new attachment",
    });
    expect(
      await db.commentAttachment.findMany({
        select: { commentId: true, uploadId: true },
      }),
    ).toEqual([{ commentId: id, uploadId: second }]);
    expect(await db.upload.findMany({ orderBy: { id: "asc" } })).toEqual(
      uploads,
    );
  });
});

it("comment.batch-delete-limit", { tags: ["@Comment/REST"] }, async ({
  comment,
}) => {
  const { db, request, seed } = comment;
  await comment.runtime(async () => {
    const ids: string[] = [];
    for (let i = 0; i < 51; i++) ids.push(await seed());
    for (const invalid of [
      [],
      ids,
      [ids[0], ids[0]],
      [ids[0], ` ${ids[0]} `],
    ]) {
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
});

it("comment.batch-delete-results", { tags: ["@Comment/REST"] }, async ({
  comment,
}) => {
  const { db, marker, owner, other, request, seed } = comment;
  await comment.runtime(async () => {
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
    expect(
      await db.comment.findUnique({ where: { id: foreign } }),
    ).toMatchObject({ status: "active" });
    expect(
      await db.comment.findUnique({ where: { id: locked } }),
    ).toMatchObject({
      status: "softbanned",
    });
  });
});

it("comment.batch-delete-shared-policy", {
  tags: ["@Comment/Service"],
}, async ({ comment }) => {
  const { db, owner, other, suspended, seed } = comment;
  await comment.runtime(async () => {
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
      expect(await deleteOwnCommentsBatch({ userId, ids: [id] })).toMatchObject(
        {
          results: [{ success: false, error: { code } }],
        },
      );
    }
  });
});

it("comment.interaction-gate", { tags: ["@Comment/REST"] }, async ({
  comment,
}) => {
  const { db, owner, suspended, request, createInput, seed } = comment;
  await comment.runtime(async () => {
    expect(
      await db.user.findUniqueOrThrow({ where: { id: suspended } }),
    ).toMatchObject({ isAdmin: true });
    const active = await seed();
    for (const viewer of [null, suspended]) {
      const expected = viewer ? 403 : 401;
      for (const invoke of [
        () => postCommentRoute(request(createInput(), "POST", viewer)),
        () =>
          patchCommentRoute(request({ body: "blocked" }, "PATCH", viewer), {
            id: active,
          }),
        () =>
          deleteCommentRoute(request(undefined, "DELETE", viewer), {
            id: active,
          }),
        () =>
          postCommentRoute(
            request(createInput({ parentId: active }), "POST", viewer),
          ),
        () =>
          postCommentReactionRoute(request({ type: "heart" }, "POST", viewer), {
            id: active,
          }),
        () =>
          deleteCommentReactionRoute(request(undefined, "DELETE", viewer), {
            id: active,
          }),
      ]) {
        const before = await readCommentState(db);
        const response = await invoke();
        expect(response.status, await response.clone().text()).toBe(expected);
        expect(await readCommentState(db)).toEqual(before);
        expect(await db.auditLog.findMany()).toEqual([]);
      }
    }
    for (const status of ["softbanned", "deleted"] as const) {
      const id = await seed(owner, status);
      for (const invoke of [
        () => patchCommentRoute(request({ body: "blocked" }, "PATCH"), { id }),
        () => deleteCommentRoute(request(undefined, "DELETE"), { id }),
        () => postCommentRoute(request(createInput({ parentId: id }))),
        () => postCommentReactionRoute(request({ type: "heart" }), { id }),
        () => deleteCommentReactionRoute(request(undefined, "DELETE"), { id }),
      ]) {
        const before = await readCommentState(db);
        const response = await invoke();
        expect(response.status, await response.clone().text()).toBe(403);
        expect(await readCommentState(db)).toEqual(before);
        expect(await db.auditLog.findMany()).toEqual([]);
      }
    }
  });
});

for (const operation of ["reply", "reaction"] as const) {
  it(`comment ${operation} succeeds without granting ownership of its seeded parent`, {
    tags: ["@Comment/REST"],
  }, async ({ comment }) => {
    const { db, other, request, createInput, seed } = comment;
    await comment.runtime(async () => {
      const id = await seed();
      const parent = await db.comment.findUniqueOrThrow({ where: { id } });
      const response =
        operation === "reply"
          ? await postCommentRoute(
              request(createInput({ parentId: id }), "POST", other),
            )
          : await postCommentReactionRoute(
              request({ type: "heart" }, "POST", other),
              { id },
            );
      expect(response.status).toBe(operation === "reply" ? 201 : 200);
      expect(await db.comment.findUniqueOrThrow({ where: { id } })).toEqual(
        parent,
      );
      if (operation === "reply") {
        expect(await db.comment.findMany({ where: { parentId: id } })).toEqual([
          expect.objectContaining({
            userId: other,
            parentId: id,
            rootId: id,
            body: parent.body,
          }),
        ]);
      } else {
        expect(
          await db.commentReaction.findMany({
            select: { commentId: true, userId: true, type: true },
          }),
        ).toEqual([{ commentId: id, userId: other, type: "heart" }]);
      }
      const before = await readCommentState(db);
      const audits = await db.auditLog.findMany({ orderBy: { id: "asc" } });
      // Participation must not confer ownership of the parent.
      for (const invoke of [
        () =>
          patchCommentRoute(request({ body: "not owned" }, "PATCH", other), {
            id,
          }),
        () => deleteCommentRoute(request(undefined, "DELETE", other), { id }),
      ]) {
        expect((await invoke()).status).toBe(403);
        expect(await readCommentState(db)).toEqual(before);
        expect(await db.auditLog.findMany({ orderBy: { id: "asc" } })).toEqual(
          audits,
        );
      }
    });
  });
}

it("comment owner edits an independently seeded active comment", {
  tags: ["@Comment/REST"],
}, async ({ comment }) => {
  const { db, request, seed } = comment;
  await comment.runtime(async () => {
    const id = await seed();
    const before = await db.comment.findUniqueOrThrow({ where: { id } });
    const response = await patchCommentRoute(
      request({ body: "owner edit" }, "PATCH"),
      { id },
    );
    expect(response.status).toBe(200);
    expect(await db.comment.findUniqueOrThrow({ where: { id } })).toEqual({
      ...before,
      body: "owner edit",
      updatedAt: expect.any(Date),
    });
  });
});

it("comment moderation authorizes its actor against a seeded active comment", {
  tags: ["@Comment/REST"],
}, async ({ comment }) => {
  const { db, owner, admin, suspended, request, seed } = comment;
  await comment.runtime(async () => {
    const id = await seed();
    const before = await db.comment.findUniqueOrThrow({ where: { id } });
    for (const viewer of [owner, suspended]) {
      expect(
        (
          await patchAdminCommentRoute(
            request({ status: "softbanned" }, "PATCH", viewer),
            { id },
          )
        ).status,
      ).toBe(viewer === suspended ? 403 : 401);
      expect(await db.comment.findUniqueOrThrow({ where: { id } })).toEqual(
        before,
      );
      expect(await db.auditLog.findMany()).toEqual([]);
    }
    expect(
      (
        await patchAdminCommentRoute(
          request({ status: "softbanned" }, "PATCH", admin),
          { id },
        )
      ).status,
    ).toBe(200);
    expect(await db.comment.findUnique({ where: { id } })).toMatchObject({
      body: before.body,
      status: "softbanned",
      moderatedById: admin,
    });
  });
});

it("comment.reply-moderation-lock", {
  tags: ["@Comment/REST"],
  timeout: 30000,
}, async ({ comment }) => {
  const {
    db,
    marker,
    owner,
    other,
    admin,
    suspended,
    request,
    createInput,
    seed,
  } = comment;
  await comment.runtime(async () => {
    for (const first of ["moderation", "reply"] as const) {
      const root = await seed();
      const reached = createDeferred<void>();
      const release = createDeferred<void>();
      // Hold only this case's parent. PostgreSQL queues the two real requests;
      // no application function is replaced or paused by a process-global spy.
      const holder = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public."Comment" WHERE id = ${root} FOR UPDATE`;
        reached.resolve();
        await release.promise;
      });
      const moderate = () =>
        patchAdminCommentRoute(
          request({ status: "softbanned" }, "PATCH", admin),
          { id: root },
        );
      const reply = () =>
        postCommentRoute(
          request(createInput({ parentId: root }), "POST", other),
        );
      let leading: Promise<Response> | undefined;
      let following: Promise<Response> | undefined;
      const leadingLabel = `leading-${crypto.randomUUID()}`;
      const followingLabel = `following-${crypto.randomUUID()}`;
      const lockWaits: Promise<void>[] = [];
      const waitForOwnLock = (label: string) => {
        const waiting = vi.waitFor(
          async () => {
            const waiting = await db.$queryRaw<{ application_name: string }[]>`
        SELECT application_name FROM pg_stat_activity
        WHERE datname = current_database() AND application_name = ${label}
          AND wait_event_type = 'Lock' AND cardinality(pg_blocking_pids(pid)) > 0
      `;
            expect(waiting).toEqual([{ application_name: label }]);
          },
          { timeout: 5000, interval: 20 },
        );
        lockWaits.push(waiting);
        return waiting;
      };
      try {
        await Promise.race([reached.promise, holder]);
        leading = comment.runtime(
          first === "moderation" ? moderate : reply,
          leadingLabel,
        );
        await Promise.race([
          waitForOwnLock(leadingLabel),
          leading.then((response) => {
            throw new Error(
              `Leading request returned ${response.status} without waiting for the parent lock`,
            );
          }),
        ]);
        following = comment.runtime(
          first === "moderation" ? reply : moderate,
          followingLabel,
        );
        await Promise.race([
          waitForOwnLock(followingLabel),
          following.then((response) => {
            throw new Error(
              `Following request returned ${response.status} without waiting for the parent lock`,
            );
          }),
        ]);
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
            await db.comment.count({
              where: { parentId: root, userId: other },
            }),
          ).toBe(1);
        }
        expect(
          await db.comment.findUnique({ where: { id: root } }),
        ).toMatchObject({ status: "softbanned" });
      } finally {
        release.resolve();
        await Promise.allSettled([holder, leading, following, ...lockWaits]);
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
});

const richCommentMarkdown =
  "**Bold content** 😀\n\n$x^2$\n\n| Header | Value |\n| --- | --- |\n| Row | Cell |";

it("comment rich-content creation preserves Markdown source", {
  tags: ["@Comment/REST"],
}, async ({ comment }) => {
  const { db, owner, teacherId, request, createInput } = comment;
  await comment.runtime(async () => {
    const response = await postCommentRoute(
      request(createInput({ body: richCommentMarkdown })),
    );
    expect(response.status).toBe(201);
    const { id } = await response.json();
    expect(id).toEqual(expect.any(String));
    expect(await db.comment.findMany()).toEqual([
      expect.objectContaining({
        id,
        userId: owner,
        teacherId,
        body: richCommentMarkdown,
      }),
    ]);
  });
});

it("comment.rich-content", { tags: ["@Comment/REST"] }, async ({ comment }) => {
  const { db, owner, other, teacherId, request } = comment;
  await comment.runtime(async () => {
    const root = await db.comment.create({
      data: { userId: owner, teacherId, body: richCommentMarkdown },
    });
    const reply = await db.comment.create({
      data: {
        userId: other,
        teacherId,
        parentId: root.id,
        rootId: root.id,
        body: "A reply",
      },
    });
    await db.commentReaction.create({
      data: { userId: other, commentId: root.id, type: "heart" },
    });
    const response = await getCommentRoute(request(undefined, "GET"), {
      id: root.id,
    });
    expect(response.status).toBe(200);
    const { thread } = await response.json();
    expect(thread).toHaveLength(1);
    expect(thread[0].id).toBe(root.id);
    expect(thread[0].body).toBe(richCommentMarkdown);
    expect(thread[0].renderedBody).toContain("<strong>Bold content</strong>");
    expect(thread[0].renderedBody).toContain("😀");
    expect(thread[0].renderedBody).toContain('class="katex"');
    expect(thread[0].renderedBody).toContain("<table>");
    expect(thread[0].replies).toEqual([
      expect.objectContaining({
        id: reply.id,
        body: "A reply",
        renderedBody: "<p>A reply</p>",
      }),
    ]);
    expect(thread[0].reactions).toEqual([
      expect.objectContaining({ type: "heart", count: 1 }),
    ]);
  });
});

for (const operation of ["create", "edit", "moderate"] as const) {
  it(operation === "create"
    ? "description.editor-authorization"
    : `description ${operation} authorizes its actor and records only its own edit`, {
    tags: ["@Description/REST"],
  }, async ({ comment }) => {
    const { db, owner, other, admin, suspended, teacherId, request } = comment;
    await comment.runtime(async () => {
      const content =
        operation === "create"
          ? "Collaborative supplement"
          : operation === "edit"
            ? "Another editor"
            : "Moderated";
      const actor =
        operation === "create" ? owner : operation === "edit" ? other : admin;
      const initial =
        operation === "create"
          ? null
          : await db.description.create({
              data: {
                teacherId,
                content: "Collaborative supplement",
                lastEditedById: owner,
                edits: {
                  create: {
                    editorId: owner,
                    previousContent: null,
                    nextContent: "Collaborative supplement",
                    createdAt: new Date("2026-01-01T00:00:00Z"),
                  },
                },
              },
            });
      if (initial)
        await db.auditLog.create({
          data: {
            action: "description_edit",
            userId: owner,
            targetId: initial.id,
            targetType: "description",
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        });
      const descriptions = await db.description.findMany();
      const history = await db.descriptionEdit.findMany({
        orderBy: { createdAt: "asc" },
      });
      const audits = await db.auditLog.findMany({
        orderBy: { createdAt: "asc" },
      });
      const body = { targetType: "teacher", teacherId, content };
      for (const [viewer, status] of [
        [operation === "moderate" ? owner : null, 401],
        [suspended, 403],
      ] as const) {
        const denied =
          operation === "moderate" && initial
            ? await patchAdminDescriptionRoute(
                request({ content: "Blocked" }, "PATCH", viewer),
                { id: initial.id },
              )
            : await postDescriptionRoute(request(body, "POST", viewer));
        expect(denied.status).toBe(status);
        expect(await db.description.findMany()).toEqual(descriptions);
        expect(
          await db.descriptionEdit.findMany({
            orderBy: { createdAt: "asc" },
          }),
        ).toEqual(history);
        expect(
          await db.auditLog.findMany({ orderBy: { createdAt: "asc" } }),
        ).toEqual(audits);
      }
      const response =
        operation === "moderate" && initial
          ? await patchAdminDescriptionRoute(
              request({ content }, "PATCH", actor),
              { id: initial.id },
            )
          : await postDescriptionRoute(request(body, "POST", actor));
      expect(response.status).toBe(200);
      const payload = await response.json();
      const id = initial?.id ?? payload.id;
      expect(id).toEqual(expect.any(String));
      if (operation === "moderate")
        expect(payload.description).toMatchObject({ id, content });
      else expect(payload).toEqual({ id, updated: true });
      expect(await db.description.findMany()).toEqual([
        expect.objectContaining({
          id,
          teacherId,
          content,
          lastEditedById: actor,
        }),
      ]);
      expect(
        await db.descriptionEdit.findMany({
          orderBy: { createdAt: "asc" },
        }),
      ).toEqual([
        ...history,
        expect.objectContaining({
          descriptionId: id,
          editorId: actor,
          previousContent: initial?.content ?? null,
          nextContent: content,
        }),
      ]);
      expect(
        await db.auditLog.findMany({
          orderBy: { createdAt: "asc" },
        }),
      ).toEqual([
        ...audits,
        expect.objectContaining({
          action:
            operation === "moderate"
              ? "admin_description_moderate"
              : "description_edit",
          targetId: id,
          userId: actor,
        }),
      ]);
    });
  });
}

it("audit.writer-2", { tags: ["@Admin/Service"] }, async ({ comment }) => {
  const { db, owner, seed } = comment;
  await comment.runtime(async () => {
    const id = await seed();
    const before = await db.comment.findUniqueOrThrow({ where: { id } });
    const invoke = (source: string) =>
      deleteOwnComment({
        userId: owner,
        commentId: id,
        auditMetadata: { source },
      });
    await expect(invoke("invalid\u0000audit-source")).rejects.toThrow();
    expect(await db.comment.findUniqueOrThrow({ where: { id } })).toEqual(
      before,
    );
    expect(
      await db.auditLog.count({
        where: { targetId: id, action: "comment_delete" },
      }),
    ).toBe(0);
    expect(await invoke("rest")).toMatchObject({ ok: true });
    expect((await db.comment.findUniqueOrThrow({ where: { id } })).status).toBe(
      "deleted",
    );
    expect(
      await db.auditLog.count({
        where: { targetId: id, action: "comment_delete", userId: owner },
      }),
    ).toBe(1);
  });
});
