/**
 * Shared comment-thread assertion helper for REST and MCP adapters.
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
