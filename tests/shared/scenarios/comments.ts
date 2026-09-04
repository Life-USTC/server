/**
 * Shared comment-thread arrange/assert helpers for REST and MCP adapters.
 * Both surfaces call the same comment read-model; envelopes differ.
 */

import { expect } from "vitest";

export type CommentListLike = {
  found?: boolean;
  data?: Array<{
    id?: string;
    body?: string;
    author?: { name?: string | null } | null;
    canReact?: boolean;
    canReply?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    reactions?: Array<{ type?: string; count?: number }>;
    replies?: Array<{ id?: string; body?: string; renderedBody?: string }>;
  }>;
  pagination?: { page?: number; pageSize?: number; total?: number };
};

export function assertCommentThreadFound<T extends CommentListLike>(
  result: T,
  expectedRootBodySubstring: string,
): NonNullable<NonNullable<T["data"]>[number]> {
  if (result.found !== undefined) {
    expect(result.found).toBe(true);
  }
  const root = result.data?.find((comment) =>
    comment.body?.includes(expectedRootBodySubstring),
  );
  expect(root).toBeDefined();
  expect(typeof root?.id).toBe("string");
  return root as NonNullable<NonNullable<T["data"]>[number]>;
}

/**
 * REST `/api/community/comments/.../replies` uses `data[]`.
 * MCP `community_comment_replies` uses `thread[]` + `rootId`.
 */
export function assertCommentRepliesPayload(
  result: {
    found?: boolean;
    rootId?: string;
    data?: Array<{ id?: string; body?: string; parentId?: string | null }>;
    thread?: Array<{
      id?: string;
      body?: string;
      parentId?: string | null;
      replies?: Array<{ id?: string }>;
    }>;
    pagination?: { page?: number; pageSize?: number };
  },
  parentId: string,
) {
  expect(result.found).toBe(true);

  if (Array.isArray(result.thread)) {
    expect(result.rootId).toBe(parentId);
    expect(result.thread.length).toBeGreaterThan(0);
    expect(result.thread.every((node) => typeof node.id === "string")).toBe(
      true,
    );
    return;
  }

  expect(Array.isArray(result.data)).toBe(true);
  expect((result.data?.length ?? 0) > 0).toBe(true);
  expect(
    result.data?.every(
      (reply) =>
        typeof reply.id === "string" &&
        (reply.parentId === parentId || reply.parentId == null),
    ),
  ).toBe(true);
}
