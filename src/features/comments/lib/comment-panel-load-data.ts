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
  commentThreadResponseSchema,
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

export async function loadCommentThreadPage({
  commentId,
  loadFailed,
}: {
  commentId: string;
  loadFailed: string;
}) {
  const result = await apiClient.GET(
    `/api/community/comments/${encodeURIComponent(commentId)}`,
  );
  if (!result.response.ok) throw new Error(loadFailed);
  const parsed = commentThreadResponseSchema.safeParse(result.data);
  if (!parsed.success) throw new Error(loadFailed);
  return parsed.data;
}

export function mergeCommentThread({
  comments,
  showAllTargets,
  target,
  thread,
}: {
  comments: CommentNodeWithContext[];
  showAllTargets: boolean;
  target: CommentTargetOption;
  thread: CommentNode[];
}) {
  const incoming = thread.map((comment) =>
    withCommentContext(comment, target, showAllTargets),
  );
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  for (const comment of incoming) {
    const previous = byId.get(comment.id);
    byId.set(
      comment.id,
      previous ? mergeCommentNode(previous, comment) : comment,
    );
  }
  return sortCommentNodes(Array.from(byId.values()));
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
  const scopedThread = thread.filter(
    (comment) => comment.id === rootId || comment.rootId === rootId,
  );
  return mergeCommentThread({
    comments,
    showAllTargets,
    target,
    thread: scopedThread,
  });
}

function mergeCommentNode(
  existing: CommentNodeWithContext,
  incoming: CommentNodeWithContext,
): CommentNodeWithContext {
  // A continuation may only contain later visible descendants, so its
  // privacy-inert root placeholder can have a later source timestamp. Keep
  // the ordering key established by the first page until the root is visible.
  const preservePlaceholderOrdering =
    existing.isAncestryPlaceholder && incoming.isAncestryPlaceholder
      ? {
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        }
      : {};
  return {
    ...existing,
    ...incoming,
    ...preservePlaceholderOrdering,
    isAncestryPlaceholder: incoming.isAncestryPlaceholder,
    replies: mergeCommentNodes(existing.replies, incoming.replies),
  };
}

function mergeCommentNodes(
  existing: CommentNodeWithContext[],
  incoming: CommentNodeWithContext[],
) {
  const byId = new Map(existing.map((comment) => [comment.id, comment]));
  for (const comment of incoming) {
    const previous = byId.get(comment.id);
    byId.set(
      comment.id,
      previous ? mergeCommentNode(previous, comment) : comment,
    );
  }
  return sortCommentNodes(Array.from(byId.values()));
}

function sortCommentNodes(
  nodes: CommentNodeWithContext[],
): CommentNodeWithContext[] {
  return nodes
    .map((node) => ({ ...node, replies: sortCommentNodes(node.replies) }))
    .sort((a, b) => {
      return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
    });
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
