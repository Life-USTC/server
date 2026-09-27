import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listModerationComments } from "@/features/admin/server/admin-moderation-comment-read-data";
import { getAdminModerationPage } from "@/features/admin/server/admin-moderation-page-data";
import {
  loadCommentReplies,
  loadCommentThread,
  loadFocusedCommentThread,
} from "@/features/comments/server/comment-read-model";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { getAdminCommentsRoute } from "@/lib/api/routes/admin-comments-list-route";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { authPrisma } from "@/lib/db/auth-prisma";
import { prisma as runtimePrisma } from "@/lib/db/prisma";
import { createFixturePrisma } from "../shared/prisma";

const db = createFixturePrisma();
const origin = "http://localhost:3000";
const marker = crypto.randomUUID();
let sectionId: number;
let ownerId: string;
let otherId: string;
let adminId: string;
let suspendedId: string;
let rootId: string;
let replyId: string;
const identities = new Map<string, string>();
const cookies = new Map<string, string>();

async function sessionCookie(userId: string) {
  const token = crypto.randomUUID();
  await db.session.create({
    data: {
      sessionToken: token,
      userId,
      expires: new Date(Date.now() + 3_600_000),
    },
  });
  const { getBetterAuthInstance } = await import("@/lib/auth/core");
  const context = await getBetterAuthInstance().$context;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(context.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(token)),
  );
  return `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${token}.${btoa(String.fromCharCode(...signature))}`)}`;
}

function request(path: string, userId?: string) {
  return new Request(`${origin}${path}`, {
    headers: userId ? { cookie: cookies.get(userId) ?? "" } : {},
  });
}

function flatten(nodes: CommentNode[]): CommentNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.replies)]);
}

beforeAll(async () => {
  const source = await db.section.findFirstOrThrow({
    select: { courseId: true, semesterId: true },
  });
  const section = await db.section.create({
    data: {
      ...source,
      jwId: -Math.floor(Math.random() * 1_000_000_000) - 1,
      code: `[integration-test] ${marker}`,
    },
  });
  sectionId = section.id;
  const users = await Promise.all(
    ["owner", "other", "admin", "suspended"].map(async (role) => {
      const user = await db.user.create({
        data: {
          name: `PRIVATE-${role}-${marker}`,
          email: `${role}-${marker}@example.test`,
          image: `https://example.test/PRIVATE-${role}-${marker}.png`,
          isAdmin: role === "admin" || role === "suspended",
        },
      });
      identities.set(user.id, user.name);
      cookies.set(user.id, await sessionCookie(user.id));
      return user;
    }),
  );
  [ownerId, otherId, adminId, suspendedId] = users.map((user) => user.id);
  await db.userSuspension.create({
    data: {
      userId: suspendedId,
      reason: "[integration-test] Suspended moderator",
    },
  });
  const root = await db.comment.create({
    data: {
      body: `[integration-test] ${marker} root`,
      sectionId,
      userId: ownerId,
      isAnonymous: true,
      visibility: "public",
    },
  });
  rootId = root.id;
  const reply = await db.comment.create({
    data: {
      body: `[integration-test] ${marker} reply`,
      sectionId,
      userId: ownerId,
      isAnonymous: true,
      visibility: "public",
      parentId: rootId,
      rootId,
    },
  });
  replyId = reply.id;
});

afterAll(async () => {
  const users = [...identities.keys()];
  await db.auditLog.deleteMany({ where: { userId: { in: users } } });
  if (sectionId) await db.section.delete({ where: { id: sectionId } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await Promise.all([
    db.$disconnect(),
    runtimePrisma.$disconnect(),
    authPrisma.$disconnect(),
  ]);
});

describe("anonymous comment identity boundaries", () => {
  it("comment.anonymous-author-privacy", async () => {
    for (const viewerUserId of [null, ownerId, otherId, adminId]) {
      const viewer = await getViewerContext({ userId: viewerUserId });
      const listed = await loadCommentThread({
        target: {
          empty: false,
          homeworkId: null,
          sectionId: null,
          sectionTeacherId: null,
          targetId: sectionId,
          teacherId: null,
          verified: true,
          whereTarget: { sectionId },
        },
        pagination: { pageSize: 20, skip: 0 },
        viewer,
        viewerUserId,
      });
      const focused = await loadFocusedCommentThread({
        commentId: replyId,
        viewerUserId,
      });
      const continuation = await loadCommentReplies({
        commentId: rootId,
        viewerUserId,
      });
      expect(focused.ok).toBe(true);
      expect(continuation.ok).toBe(true);
      if (!focused.ok || !continuation.ok)
        throw new Error("Expected readable anonymous thread");
      for (const thread of [
        listed.comments,
        focused.thread,
        continuation.thread,
      ]) {
        const nodes = flatten(thread).filter((node) =>
          [rootId, replyId].includes(node.id),
        );
        expect(nodes).toHaveLength(2);
        for (const node of nodes) {
          expect(node).toMatchObject({
            author: null,
            authorHidden: true,
            isAnonymous: true,
            isAuthor: viewerUserId === ownerId,
            canEdit: viewerUserId === ownerId,
            canDelete: viewerUserId === ownerId,
          });
          const serialized = JSON.stringify(node);
          expect(serialized).not.toContain(ownerId);
          expect(serialized).not.toContain(identities.get(ownerId));
          expect(serialized).not.toContain("PRIVATE-owner");
        }
      }
    }
    expect(
      await db.auditLog.count({
        where: {
          action: "admin_comment_identity_reveal",
          targetId: { in: [rootId, replyId] },
        },
      }),
    ).toBe(0);
  });

  it("comment.governance-anonymous-author-access", async () => {
    const url = new URL(`${origin}/admin/moderation`);
    await expect(
      getAdminModerationPage(request(url.pathname), url),
    ).rejects.toMatchObject({ status: 303 });
    expect(
      (await getAdminCommentsRoute(request("/api/admin/comments"))).status,
    ).toBe(401);
    for (const userId of [ownerId, otherId, suspendedId]) {
      await expect(
        getAdminModerationPage(request(url.pathname, userId), url),
      ).rejects.toMatchObject({ status: 403 });
      const response = await getAdminCommentsRoute(
        request("/api/admin/comments", userId),
      );
      expect([401, 403]).toContain(response.status);
      expect(await response.text()).not.toContain(identities.get(ownerId));
      await expect(
        listModerationComments({
          adminUserId: userId,
          commentWhere: { id: rootId },
          pageSize: 20,
        }),
      ).rejects.toMatchObject({ status: 403 });
    }
  });

  it("comment.governance-anonymous-author-audit", async () => {
    const webRows = await listModerationComments({
      adminUserId: adminId,
      commentWhere: { id: rootId },
      pageSize: 20,
    });
    expect(webRows).toHaveLength(1);
    expect(webRows[0]).toMatchObject({
      userId: ownerId,
      user: { id: ownerId, name: identities.get(ownerId) },
    });
    const response = await getAdminCommentsRoute(
      request("/api/admin/comments?pageSize=200", adminId),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(
      body.data.find((row: { id: string }) => row.id === rootId),
    ).toMatchObject({
      userId: ownerId,
      user: { name: identities.get(ownerId) },
    });
    const auditRows = await db.auditLog.findMany({
      where: {
        userId: adminId,
        targetId: rootId,
        action: "admin_comment_identity_reveal",
      },
      select: {
        action: true,
        channel: true,
        targetId: true,
        targetType: true,
        userId: true,
        subjectUserId: true,
        metadata: true,
      },
      orderBy: { createdAt: "asc" },
    });
    expect(auditRows).toEqual(
      ["web", "rest"].map((channel) => ({
        action: "admin_comment_identity_reveal",
        channel,
        userId: adminId,
        targetId: rootId,
        targetType: "comment",
        subjectUserId: null,
        metadata: null,
      })),
    );
    expect(JSON.stringify(auditRows)).not.toContain(ownerId);
    expect(JSON.stringify(auditRows)).not.toContain(identities.get(ownerId));
  });
});
