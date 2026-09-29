import { loadCommentThread } from "@/features/comments/server/comment-read-model";
import { encodeCommentReplyCursor } from "@/features/comments/server/comment-reply-pagination";
import { resolveCommentTargetReference } from "@/features/comments/server/comment-target-resolution";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { commentReadTest } from "../shared/comment-read-contract-fixture";

type List = {
  data: CommentNode[];
  meta: Record<string, unknown>;
  pagination: { page: number; pageSize: number; total: number };
};

commentReadTest(
  "comment.shared-read-policy",
  async ({ reader, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const {
        teacherId,
        owner,
        other,
        admin,
        rootId,
        loginId,
        hiddenId,
        getCommentsRoute,
        request,
        listPath,
        mcp,
      } = reader;
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
        expect(rest.data.some((row) => row.id === loginId)).toBe(
          Boolean(viewer),
        );
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
    }),
);

commentReadTest(
  "comment.rest-pagination-parameters",
  async ({ reader, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const {
        getCommentsRoute,
        listPath,
        owner,
        getAdminCommentsRoute,
        admin,
        request,
      } = reader;
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
    }),
);

commentReadTest(
  "description.rest-pagination-parameters",
  async ({ reader, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { marker, getAdminDescriptionsRoute, request, admin } = reader;
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
    }),
);

commentReadTest(
  "comment.mcp-pagination-parameters",
  async ({ reader, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const { mcp, owner, teacherId, rootId } = reader;
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
    }),
);

commentReadTest(
  "comment.focused-read-errors",
  async ({ reader, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const {
        marker,
        hiddenId,
        owner,
        loginId,
        deletedId,
        getCommentRoute,
        request,
      } = reader;
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
    }),
);

commentReadTest(
  "comment.reply-read-errors",
  async ({ reader, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const {
        marker,
        hiddenId,
        owner,
        loginId,
        deletedId,
        getCommentRepliesRoute,
        request,
        rootIds,
        rootId,
      } = reader;
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
    }),
);

commentReadTest(
  "comment.moderation-default-status",
  async ({ reader, protocolRuntime, expect }) =>
    protocolRuntime.run(async () => {
      const {
        getAdminCommentsRoute,
        request,
        admin,
        rootId,
        getAdminModerationPage,
        origin,
      } = reader;
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
      expect(body.data.some((row: { id: string }) => row.id === rootId)).toBe(
        true,
      );
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
    }),
);
