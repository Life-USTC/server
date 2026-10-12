import { describe } from "vitest";
import { listModerationComments } from "@/features/admin/server/admin-moderation-comment-read-data";
import {
  loadCommentReplies,
  loadCommentThread,
  loadFocusedCommentThread,
} from "@/features/comments/server/comment-read-model";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { getViewerContext } from "@/lib/auth/viewer-context";
import { commentPrivacyTest } from "../shared/comment-privacy-contract-fixture";

function flatten(nodes: CommentNode[]): CommentNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.replies)]);
}

describe("anonymous comment identity boundaries", () => {
  commentPrivacyTest(
    "comment.anonymous-author-privacy",
    { tags: ["@Comment/Service"] },
    async ({ privacy, protocolRuntime, expect }) =>
      protocolRuntime.run(async () => {
        const {
          db,
          sectionId,
          ownerId,
          otherId,
          adminId,
          rootId,
          replyId,
          identities,
        } = privacy;
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
      }),
  );

  commentPrivacyTest(
    "comment.governance-anonymous-author-access",
    { tags: ["@Comment/Service"] },
    async ({ privacy, protocolRuntime, expect }) =>
      protocolRuntime.run(async () => {
        const {
          origin,
          ownerId,
          otherId,
          suspendedId,
          rootId,
          identities,
          request,
          getAdminModerationPage,
          getAdminCommentsRoute,
        } = privacy;
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
      }),
  );

  commentPrivacyTest(
    "comment.governance-anonymous-author-audit",
    { tags: ["@Comment/Service"] },
    async ({ privacy, protocolRuntime, expect }) =>
      protocolRuntime.run(async () => {
        const {
          db,
          ownerId,
          adminId,
          rootId,
          identities,
          request,
          getAdminCommentsRoute,
        } = privacy;
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
        expect(JSON.stringify(auditRows)).not.toContain(
          identities.get(ownerId),
        );
      }),
  );
});
