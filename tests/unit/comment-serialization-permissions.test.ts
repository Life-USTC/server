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

describe("comment serialization permissions", () => {
  it("keeps normal author reply and edit affordances", () => {
    const { roots } = buildCommentNodes([comment()], viewer());

    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({
      canEdit: true,
      canModerate: false,
      canReply: true,
      isAuthor: true,
    });
  });

  it("removes write affordances for suspended authors", () => {
    const { roots } = buildCommentNodes(
      [comment()],
      viewer({ isSuspended: true }),
    );

    expect(roots).toHaveLength(1);
    expect(roots[0]).toMatchObject({
      canEdit: false,
      canModerate: false,
      canReply: false,
      isAuthor: true,
    });
  });

  it("preserves suspended admin moderation affordances", () => {
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
      canEdit: false,
      canModerate: true,
      canReply: false,
      isAuthor: false,
    });
  });
});
