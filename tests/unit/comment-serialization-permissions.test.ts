import { describe, expect, it } from "vitest";
import {
  buildCommentNodes,
  type CommentNode,
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
  it("在服务端序列化 sanitized Markdown HTML", () => {
    const { roots } = buildCommentNodes(
      [
        comment({
          body: 'section#123 <script>alert("xss")</script>',
        }),
      ],
      viewer(),
    );

    expect(roots[0]?.renderedBody).toContain('href="/catalog/sections/123"');
    expect(roots[0]?.renderedBody).not.toContain("<script>");
  });

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

  it("将可见回复挂回可见根而不暴露缺失的祖先", () => {
    const { roots } = buildCommentNodes(
      [
        comment({ id: "root", rootId: "root" }),
        comment({
          body: "private ancestor body",
          createdAt: new Date("2035-01-01T00:00:00.000Z"),
          id: "hidden-parent",
          parentId: "root",
          rootId: "root",
          status: "softbanned",
          updatedAt: new Date("2035-01-02T00:00:00.000Z"),
          visibility: "logged_in_only",
        }),
        comment({
          id: "visible-child",
          parentId: "hidden-parent",
          rootId: "root",
        }),
      ],
      viewer({ isAuthenticated: false, userId: null }),
    );

    expect(roots).toHaveLength(1);
    expect(roots[0]?.id).toBe("root");
    expect(roots[0]?.replies.map((reply) => reply.id)).toEqual([
      "hidden-parent",
    ]);
    expect(roots[0]?.replies[0]).toMatchObject({
      body: "",
      createdAt: "2026-01-01T08:00:00+08:00",
      isAncestryPlaceholder: true,
      status: "active",
      updatedAt: "2026-01-01T08:00:00+08:00",
      visibility: "public",
    });
    expect(roots[0]?.replies[0]?.replies.map((reply) => reply.id)).toEqual([
      "visible-child",
    ]);
    expectNestedParentIds(roots);
  });

  it("为隐藏根保留可见分支且每个根只产生一个列表条目", () => {
    const { roots } = buildCommentNodes(
      [
        comment({
          id: "hidden-root",
          rootId: "hidden-root",
          visibility: "logged_in_only",
        }),
        comment({
          id: "visible-child-1",
          parentId: "hidden-root",
          rootId: "hidden-root",
        }),
        comment({
          id: "visible-child-2",
          parentId: "hidden-root",
          rootId: "hidden-root",
        }),
      ],
      viewer({ isAuthenticated: false, userId: null }),
    );

    expect(roots).toHaveLength(1);
    expect(countNodes(roots)).toBe(3);
    expect(roots[0]).toMatchObject({
      body: "",
      id: "hidden-root",
      isAncestryPlaceholder: true,
      rootId: "hidden-root",
      status: "active",
      visibility: "public",
    });
    expect(roots[0]?.replies.map((reply) => reply.parentId)).toEqual([
      "hidden-root",
      "hidden-root",
    ]);
    expectNestedParentIds(roots);
  });

  it("使用最早可见后代作为隐藏根的 viewer-safe 排序键", () => {
    const { roots } = buildCommentNodes(
      [
        comment({
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
          id: "hidden-root",
          rootId: "hidden-root",
          visibility: "logged_in_only",
        }),
        comment({
          createdAt: new Date("2020-03-01T00:00:00.000Z"),
          id: "later-visible-child",
          parentId: "hidden-root",
          rootId: "hidden-root",
        }),
        comment({
          createdAt: new Date("2020-02-01T00:00:00.000Z"),
          id: "earlier-visible-child",
          parentId: "hidden-root",
          rootId: "hidden-root",
        }),
      ],
      viewer({ isAuthenticated: false, userId: null }),
    );

    expect(roots[0]).toMatchObject({
      createdAt: "2020-02-01T08:00:00+08:00",
      id: "hidden-root",
      isAncestryPlaceholder: true,
    });
  });
});

function countNodes(nodes: CommentNode[]): number {
  return nodes.reduce((count, node) => count + 1 + countNodes(node.replies), 0);
}

function expectNestedParentIds(nodes: CommentNode[]) {
  for (const node of nodes) {
    for (const reply of node.replies) {
      expect(reply.parentId).toBe(node.id);
      expectNestedParentIds([reply]);
    }
  }
}
