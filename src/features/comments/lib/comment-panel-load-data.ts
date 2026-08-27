import {
  type CommentNodeWithContext,
  type CommentTargetOption,
  withCommentContext,
} from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { apiClient } from "@/lib/api/client";
import {
  commentRepliesResponseSchema,
  commentsListResponseSchema,
} from "@/lib/api/schemas/comments-response-schemas";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import {
  commentTargetCanLoad,
  commentTargetSearchParams,
  visibleCommentsForTargets,
} from "./comment-panel-target-loading";

export type CommentsInitialData = {
  commentMap: Record<string, CommentNode[]>;
  complete?: boolean;
  hiddenCount: number;
  hiddenMap?: Record<string, number>;
  viewer: ViewerContext;
};

export type CommentTargetLoadState = {
  comments: CommentNodeWithContext[];
  hiddenCount: number;
  loaded: boolean;
  page: number;
  target: CommentTargetOption;
  total: number;
  totalPages: number;
};

export type LoadedCommentTargetPage = {
  comments: CommentNodeWithContext[];
  hiddenCount: number;
  page: number;
  target: CommentTargetOption;
  total: number;
  totalPages: number;
  viewer: ViewerContext;
};

export type CommentsLoadResult = {
  entries: LoadedCommentTargetPage[];
  comments: CommentNodeWithContext[];
  hiddenCount: number;
  viewer?: ViewerContext;
};

export function commentsFromInitialData({
  data,
  showAllTargets,
  targets,
}: {
  data: CommentsInitialData;
  showAllTargets: boolean;
  targets: CommentTargetOption[];
}) {
  const nextMap: Record<string, CommentNodeWithContext[]> = {};
  for (const target of targets) {
    nextMap[target.key] = (data.commentMap[target.key] ?? []).map((comment) =>
      withCommentContext(comment, target, showAllTargets),
    );
  }
  return {
    comments: visibleCommentsForTargets({
      showAllTargets,
      targetComments: nextMap,
      targets,
    }),
    hiddenCount: data.hiddenCount,
    viewer: data.viewer,
  };
}

/**
 * Load exactly one bounded root page per requested target. Callers decide
 * which target/page to continue; this function never walks later pages.
 */
export async function loadCommentsForTargets({
  loadFailed,
  pageByTarget = {},
  showAllTargets,
  targetKeys,
  targets,
}: {
  loadFailed: string;
  pageByTarget?: Record<string, number>;
  showAllTargets: boolean;
  targetKeys?: string[];
  targets: CommentTargetOption[];
}): Promise<CommentsLoadResult> {
  const loadableTargets = targets.filter(commentTargetCanLoad);
  const requestedKeys = new Set(
    targetKeys ?? loadableTargets.slice(0, 1).map((target) => target.key),
  );
  const entries = await Promise.all(
    loadableTargets
      .filter((target) => requestedKeys.has(target.key))
      .map(async (target) => {
        const params = commentTargetSearchParams(target);
        const page = pageByTarget[target.key] ?? 1;
        params.set("pageSize", "20");
        params.set("page", String(page));
        const response = await loadCommentPage(params, loadFailed);
        return {
          comments: response.data.map((comment) =>
            withCommentContext(comment, target, showAllTargets),
          ),
          hiddenCount: response.meta.hiddenCount,
          page: response.pagination.page,
          target,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
          viewer: response.meta.viewer,
        } satisfies LoadedCommentTargetPage;
      }),
  );

  return {
    entries,
    comments: visibleCommentsForTargets({
      showAllTargets,
      targetComments: Object.fromEntries(
        entries.map((entry) => [entry.target.key, entry.comments]),
      ),
      targets,
    }),
    hiddenCount: entries.reduce((total, entry) => total + entry.hiddenCount, 0),
    viewer: entries[0]?.viewer,
  };
}

export async function loadCommentRepliesPage({
  cursor,
  loadFailed,
  pageSize = 20,
  rootId,
}: {
  cursor: string;
  loadFailed: string;
  pageSize?: number;
  rootId: string;
}) {
  const params = new URLSearchParams({ cursor, pageSize: String(pageSize) });
  const result = await apiClient.GET(
    `/api/community/comments/${encodeURIComponent(rootId)}/replies?${params.toString()}`,
  );
  if (!result.response.ok) throw new Error(loadFailed);
  const parsed = commentRepliesResponseSchema.safeParse(result.data);
  if (!parsed.success) throw new Error(loadFailed);
  return parsed.data;
}

export function mergeCommentReplyThread({
  comments,
  rootId,
  showAllTargets,
  target,
  thread,
}: {
  comments: CommentNodeWithContext[];
  rootId: string;
  showAllTargets: boolean;
  target: CommentTargetOption;
  thread: CommentNode[];
}) {
  const incomingRoot = findCommentNode(thread, rootId);
  if (!incomingRoot) return comments;
  const incoming = withCommentContext(incomingRoot, target, showAllTargets);

  function mergeNodes(
    nodes: CommentNodeWithContext[],
  ): CommentNodeWithContext[] {
    return nodes.map((node) => {
      if (node.id === rootId) {
        return {
          ...node,
          replies: mergeReplyNodes(node.replies, incoming.replies),
          repliesNextCursor: incoming.repliesNextCursor,
        };
      }
      return { ...node, replies: mergeNodes(node.replies) };
    });
  }

  return mergeNodes(comments);
}

function mergeReplyNodes(
  existing: CommentNodeWithContext[],
  incoming: CommentNodeWithContext[],
) {
  const byId = new Map(existing.map((node) => [node.id, node]));
  for (const node of incoming) {
    const previous = byId.get(node.id);
    byId.set(
      node.id,
      previous
        ? {
            ...previous,
            replies: mergeReplyNodes(previous.replies, node.replies),
            repliesNextCursor: node.repliesNextCursor,
          }
        : node,
    );
  }
  return sortReplyNodes(Array.from(byId.values()));
}

function sortReplyNodes(
  nodes: CommentNodeWithContext[],
): CommentNodeWithContext[] {
  return nodes
    .map((node) => ({ ...node, replies: sortReplyNodes(node.replies) }))
    .sort((a, b) => {
      const aVerified = a.author?.isUstcVerified ? 1 : 0;
      const bVerified = b.author?.isUstcVerified ? 1 : 0;
      if (aVerified !== bVerified) return bVerified - aVerified;
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
}

function findCommentNode(
  comments: CommentNode[],
  id: string,
): CommentNode | null {
  for (const comment of comments) {
    if (comment.id === id) return comment;
    const nested = findCommentNode(comment.replies, id);
    if (nested) return nested;
  }
  return null;
}

async function loadCommentPage(params: URLSearchParams, loadFailed: string) {
  const result = await apiClient.GET(
    `/api/community/comments?${params.toString()}`,
  );
  if (!result.response.ok) throw new Error(loadFailed);
  const parsed = commentsListResponseSchema.safeParse(result.data);
  if (!parsed.success) throw new Error(loadFailed);
  return parsed.data;
}
