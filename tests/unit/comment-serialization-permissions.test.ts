import { describe, expect, it } from "vitest";
import {
  buildCommentNodes,
  type RawComment,
  type ViewerInfo,
} from "@/features/comments/server/comment-serialization";

const now = new Date("2026-01-01T00:00:00.000Z");

function comment(overrides: Partial<RawComment> = {}): RawComment {
  return {
    id: "comment-1",
    body: "body",
    visibility: "public",
    status: "active",
    userId: "user-1",
    user: {
      id: "user-1",
      name: "Author",
      image: null,
      isAdmin: false,
      accounts: [],
    },
    createdAt: now,
    updatedAt: now,
    parentId: null,
    rootId: "comment-1",
    attachments: [],
    reactions: [],
    ...overrides,
  };
}

function attachment() {
  return {
    id: "attachment-1",
    uploadId: "upload-1",
    upload: {
      contentType: "text/plain",
      filename: "note.txt",
      size: 123,
    },
  };
}

function viewer(overrides: Partial<ViewerInfo> = {}): ViewerInfo {
  return {
    userId: "user-1",
    name: "Viewer",
    image: null,
    isAdmin: false,
    isAuthenticated: true,
    isSuspended: false,
    ...overrides,
  };
}

describe("评论序列化权限", () => {
  it("保留普通作者的回复和编辑权限", () => {
    const { roots } = buildCommentNodes([comment()], viewer());

    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({
      canDelete: true,
      canEdit: true,
      canModerate: false,
      canReact: true,
      canReply: true,
      isAuthor: true,
    });
  });

  it("移除被暂停作者的写入权限", () => {
    const { roots } = buildCommentNodes(
      [comment()],
      viewer({ isSuspended: true }),
    );

    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({
      canDelete: false,
      canEdit: false,
      canModerate: false,
      canReact: false,
      canReply: false,
      isAuthor: true,
    });
  });

  it("移除被暂停管理员的管理权限", () => {
    const { roots } = buildCommentNodes(
      [comment({ userId: "user-1" })],
      viewer({
        userId: "admin-1",
        isAdmin: true,
        isSuspended: true,
      }),
    );

    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({
      canDelete: false,
      canEdit: false,
      canModerate: false,
      canReact: false,
      canReply: false,
      isAuthor: false,
    });
  });

  it("为可见回复保留已删除占位但省略附件", () => {
    const { roots } = buildCommentNodes(
      [
        comment({
          attachments: [attachment()],
          status: "deleted",
        }),
        comment({
          id: "reply-1",
          body: "reply",
          parentId: "comment-1",
          rootId: "comment-1",
          userId: "user-2",
        }),
      ],
      viewer(),
    );

    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({
      status: "deleted",
      attachments: [],
      canDelete: false,
      canReact: false,
      canReply: false,
    });
    expect(roots[0].replies).toHaveLength(1);
  });

  it("从软封禁评论中移除写入权限", () => {
    const authorView = buildCommentNodes(
      [comment({ status: "softbanned" })],
      viewer(),
    );
    const adminView = buildCommentNodes(
      [comment({ status: "softbanned" })],
      viewer({ isAdmin: true, userId: "admin-1" }),
    );

    expect(authorView.roots[0]).toMatchObject({
      canDelete: false,
      canEdit: false,
      canReact: false,
      canReply: false,
      status: "active",
    });
    expect(adminView.roots[0]).toMatchObject({
      canDelete: false,
      canEdit: false,
      canReact: false,
      canReply: false,
      status: "softbanned",
    });
  });

  it("仅向已认证查看者暴露附件操作", () => {
    const rawComment = comment({ attachments: [attachment()] });

    const anonymous = buildCommentNodes(
      [rawComment],
      viewer({
        isAuthenticated: false,
        userId: null,
      }),
    );
    const authenticated = buildCommentNodes([rawComment], viewer());

    expect(anonymous.roots[0]?.attachments).toEqual([]);
    expect(authenticated.roots[0]?.attachments).toHaveLength(1);
  });
});
