import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { getAdminModerationPage } from "@/features/admin/server/admin-moderation-page-data";
import { loadCommentThread } from "@/features/comments/server/comment-read-model";
import { encodeCommentReplyCursor } from "@/features/comments/server/comment-reply-pagination";
import { resolveCommentTargetReference } from "@/features/comments/server/comment-target-resolution";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { getAdminCommentsRoute } from "@/lib/api/routes/admin-comments-list-route";
import { getAdminDescriptionsRoute } from "@/lib/api/routes/admin-descriptions";
import { getCommentsRoute } from "@/lib/api/routes/comments-list-route";
import { getCommentRepliesRoute } from "@/lib/api/routes/comments-replies-route";
import { getCommentRoute } from "@/lib/api/routes/comments-thread-route";
import { getBetterAuthInstance } from "@/lib/auth/core";
import { createFixturePrisma } from "../shared/prisma";
import {
  createAnonymousMcpHarness,
  createMcpHarness,
  type McpHarness,
} from "./mcp/_harness/client";

const db = createFixturePrisma();
const marker = crypto.randomUUID();
const origin = "http://localhost:3000";
const users = ["owner", "other", "admin"].map((role) => `${role}-${marker}`);
const [owner, other, admin] = users;
const cookies = new Map<string, string>();
const clients = new Map<string | null, McpHarness>();
let teacherId: number;
let rootId: string;
let hiddenId: string;
let deletedId: string;
let loginId: string;
const rootIds: string[] = [];
type List = {
  data: CommentNode[];
  meta: Record<string, unknown>;
  pagination: { page: number; pageSize: number; total: number };
};
beforeAll(async () => {
  for (const id of users) {
    await db.user.create({
      data: {
        id,
        email: `${id}@example.test`,
        name: id,
        isAdmin: id === admin,
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
    clients.set(id, await createMcpHarness(id));
  }
  clients.set(null, await createAnonymousMcpHarness());
  teacherId = (
    await db.teacher.create({
      data: { nameCn: marker, jwId: -Math.floor(Math.random() * 1e9) - 1 },
    })
  ).id;
  for (let index = 0; index < 3; index++)
    rootIds.push(
      (
        await db.comment.create({
          data: {
            teacherId,
            userId: owner,
            body: `${marker} public-${index} **bold**`,
            isAnonymous: index === 0,
            createdAt: new Date(Date.now() - 3000 + index * 1000),
          },
        })
      ).id,
    );
  rootId = rootIds[0];
  for (let index = 0; index < 13; index++)
    await db.comment.create({
      data: {
        teacherId,
        userId: owner,
        body: `${marker} reply-${index}`,
        parentId: rootId,
        rootId,
      },
    });
  hiddenId = (
    await db.comment.create({
      data: {
        teacherId,
        userId: other,
        body: `${marker} hidden`,
        status: "softbanned",
      },
    })
  ).id;
  deletedId = (
    await db.comment.create({
      data: {
        teacherId,
        userId: owner,
        body: `${marker} deleted`,
        status: "deleted",
      },
    })
  ).id;
  loginId = (
    await db.comment.create({
      data: {
        teacherId,
        userId: owner,
        body: `${marker} login`,
        visibility: "logged_in_only",
      },
    })
  ).id;
  const upload = await db.upload.create({
    data: { userId: owner, key: marker, filename: "contract.txt", size: 12 },
  });
  await db.commentAttachment.create({
    data: { commentId: rootId, uploadId: upload.id },
  });
  await db.commentReaction.create({
    data: { commentId: rootId, userId: owner, type: "heart" },
  });
  await db.description.create({
    data: {
      teacherId,
      content: `${marker} description one`,
      lastEditedById: owner,
      lastEditedAt: new Date(),
    },
  });
  const teacher2 = await db.teacher.create({
    data: { nameCn: marker, jwId: -Math.floor(Math.random() * 1e9) - 1 },
  });
  await db.description.create({
    data: {
      teacherId: teacher2.id,
      content: `${marker} description two`,
      lastEditedById: owner,
      lastEditedAt: new Date(),
    },
  });
});
afterAll(async () => {
  for (const client of clients.values()) await client.close();
  await db.auditLog.deleteMany({ where: { userId: { in: users } } });
  await db.teacher.deleteMany({ where: { nameCn: marker } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});
function request(path: string, userId: string | null = null) {
  return new Request(`${origin}${path}`, {
    headers: userId ? { cookie: cookies.get(userId) ?? "" } : {},
  });
}
function listPath(params = "") {
  return `/api/community/comments?targetType=teacher&teacherId=${teacherId}${params}`;
}
function mcp(userId: string | null) {
  const client = clients.get(userId);
  if (!client) throw new Error("Missing MCP fixture");
  return client;
}

it("comment.shared-read-policy", async () => {
  const resolved = await resolveCommentTargetReference({
    targetType: "teacher",
    teacherId,
    verifyExistence: true,
    includeTargetMetadata: true,
  });
  if (!resolved.ok) throw new Error("Missing teacher target");
  for (const viewer of [null, owner, other, admin]) {
    const web = await loadCommentThread({
      target: resolved.target,
      viewerUserId: viewer,
      pagination: { pageSize: 20, skip: 0 },
    });
    const response = await getCommentsRoute(request(listPath(), viewer));
    expect(response.status).toBe(200);
    const rest: List = await response.json();
    expect(rest.data).toEqual(web.comments);
    if (viewer) {
      const tool = await mcp(viewer).call<List>("community_comment_list", {
        targetType: "teacher",
        teacherId,
        mode: "full",
      });
      expect(tool.data).toEqual(rest.data);
      expect(tool.meta).toEqual(rest.meta);
    } else {
      await expect(
        mcp(null).call("community_comment_list", {
          targetType: "teacher",
          teacherId,
        }),
      ).rejects.toThrow("Authenticated user context is missing");
    }
    expect(rest.meta.viewer).toEqual(web.viewer);
    expect(rest.meta.hiddenCount).toBe(web.hiddenCount);
    const anonymousRoot = rest.data.find((row) => row.id === rootId);
    expect(anonymousRoot).toMatchObject({
      author: null,
      authorHidden: true,
      reactions: [
        { type: "heart", count: 1, viewerHasReacted: viewer === owner },
      ],
    });
    expect(anonymousRoot?.attachments.length).toBe(viewer ? 1 : 0);
    expect(rest.data.some((row) => row.id === loginId)).toBe(Boolean(viewer));
    expect(
      rest.data.some((row) => row.id === hiddenId),
      JSON.stringify({
        viewer,
        meta: rest.meta,
        ids: rest.data.map((row) => row.id),
        hiddenId,
      }),
    ).toBe(viewer === other);
  }
});

it("comment.rest-pagination-parameters", async () => {
  for (const [route, path, viewer] of [
    [getCommentsRoute, listPath(), owner],
    [getAdminCommentsRoute, "/api/admin/comments?status=active", admin],
  ] as const) {
    const pages = [];
    for (const page of [1, 2]) {
      const response = await route(
        request(`${path}&page=${page}&pageSize=1`, viewer),
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data).toHaveLength(1);
      expect(body.pagination).toMatchObject({ page, pageSize: 1 });
      pages.push(body);
    }
    expect(pages[0].data[0].id).not.toBe(pages[1].data[0].id);
    expect(pages[0].pagination.total).toBe(pages[1].pagination.total);
    for (const limit of ["1", "invalid"])
      expect(
        (await route(request(`${path}&limit=${limit}`, viewer))).status,
      ).toBe(400);
  }
});

it("description.rest-pagination-parameters", async () => {
  const path = `/api/admin/descriptions?search=${marker}`;
  const first = await getAdminDescriptionsRoute(
    request(`${path}&page=1&pageSize=1`, admin),
  );
  const second = await getAdminDescriptionsRoute(
    request(`${path}&page=2&pageSize=1`, admin),
  );
  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  const a = await first.json();
  const b = await second.json();
  expect(a.data).toHaveLength(1);
  expect(b.data).toHaveLength(1);
  expect(a.pagination).toMatchObject({ page: 1, pageSize: 1, total: 2 });
  expect(b.pagination).toMatchObject({ page: 2, pageSize: 1, total: 2 });
  expect(a.data[0].id).not.toBe(b.data[0].id);
  for (const limit of ["1", "invalid"])
    expect(
      (
        await getAdminDescriptionsRoute(
          request(`${path}&limit=${limit}`, admin),
        )
      ).status,
    ).toBe(400);
});

it("comment.mcp-pagination-parameters", async () => {
  const pages: List[] = [];
  for (const page of [1, 2]) {
    const result = await mcp(owner).call<List>("community_comment_list", {
      targetType: "teacher",
      teacherId,
      page,
      limit: 1,
      mode: "full",
    });
    expect(result.data).toHaveLength(1);
    expect(result.pagination).toMatchObject({ page, pageSize: 1 });
    pages.push(result);
  }
  expect(pages[0].pagination.total).toBe(pages[1].pagination.total);
  expect(pages[0].data[0].id).not.toBe(pages[1].data[0].id);
  const all = await mcp(owner).call<List>("community_comment_list", {
    targetType: "teacher",
    teacherId,
    limit: 100,
    mode: "full",
  });
  const root = all.data.find((row) => row.id === rootId);
  expect(root?.replies).toHaveLength(10);
  expect(root?.repliesNextCursor).toBeTruthy();
  const continuation = await mcp(owner).call<{
    thread: CommentNode[];
    nextCursor: null;
  }>("community_comment_replies", {
    commentId: rootId,
    cursor: root?.repliesNextCursor,
    mode: "full",
  });
  expect(continuation.thread[0].replies).toHaveLength(3);
  expect(continuation.nextCursor).toBeNull();
});

it("comment.focused-read-errors", async () => {
  for (const [id, viewer, status] of [
    [`missing-${marker}`, null, 404],
    [hiddenId, owner, 404],
    [loginId, null, 404],
    [deletedId, owner, 403],
  ] as const) {
    const response = await getCommentRoute(
      request(`/api/community/comments/${id}`, viewer),
      { id },
    );
    expect(response.status, await response.clone().text()).toBe(status);
    expect(await response.json()).not.toHaveProperty("thread");
  }
});

it("comment.reply-read-errors", async () => {
  for (const [id, viewer, status] of [
    [`missing-${marker}`, null, 404],
    [hiddenId, owner, 404],
    [loginId, null, 404],
    [deletedId, owner, 403],
  ] as const) {
    const response = await getCommentRepliesRoute(
      request(`/api/community/comments/${id}/replies`, viewer),
      { id },
    );
    expect(response.status, await response.clone().text()).toBe(status);
    expect(await response.json()).not.toHaveProperty("thread");
  }
  const cross = encodeCommentReplyCursor({
    rootId: rootIds[1],
    id: rootIds[1],
    createdAt: new Date().toISOString(),
  });
  for (const cursor of ["malformed", cross]) {
    const response = await getCommentRepliesRoute(
      request(
        `/api/community/comments/${rootId}/replies?cursor=${cursor}`,
        owner,
      ),
      { id: rootId },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).not.toHaveProperty("thread");
  }
});

it("comment.moderation-default-status", async () => {
  const implicit = await getAdminCommentsRoute(
    request("/api/admin/comments?pageSize=200", admin),
  );
  const explicit = await getAdminCommentsRoute(
    request("/api/admin/comments?status=active&pageSize=200", admin),
  );
  expect(implicit.status).toBe(200);
  expect(explicit.status).toBe(200);
  const body = await implicit.json();
  expect(body).toEqual(await explicit.json());
  expect(body.data.some((row: { id: string }) => row.id === rootId)).toBe(true);
  expect(
    body.data.every((row: { status: string }) => row.status === "active"),
  ).toBe(true);
  const web = await getAdminModerationPage(
    request("/admin/moderation", admin),
    new URL(`${origin}/admin/moderation`),
  );
  expect(web.filters.status).toBe("active");
  expect(web.comments.some((row) => row.id === rootId)).toBe(true);
  expect(web.comments.every((row) => row.status === "active")).toBe(true);
});
