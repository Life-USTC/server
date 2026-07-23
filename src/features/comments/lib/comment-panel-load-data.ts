import {
  type CommentNodeWithContext,
  type CommentTargetOption,
  withCommentContext,
} from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
import { apiClient } from "@/lib/api/client";
import { commentsListResponseSchema } from "@/lib/api/schemas/comments-response-schemas";
import type { ViewerContext } from "@/lib/auth/viewer-context";
import {
  commentTargetCanLoad,
  commentTargetEntriesResult,
  commentTargetSearchParams,
  visibleCommentsForTargets,
} from "./comment-panel-target-loading";

export type CommentsInitialData = {
  commentMap: Record<string, CommentNode[]>;
  hiddenCount: number;
  hiddenMap?: Record<string, number>;
  viewer: ViewerContext;
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

export async function loadCommentsForTargets({
  loadFailed,
  showAllTargets,
  targets,
}: {
  loadFailed: string;
  showAllTargets: boolean;
  targets: CommentTargetOption[];
}) {
  const loadedEntries = await Promise.all(
    targets.filter(commentTargetCanLoad).map(async (target) => {
      const params = commentTargetSearchParams(target);
      params.set("pageSize", "100");
      params.set("page", "1");
      const firstPage = await loadCommentPage(params, loadFailed);
      const comments = [...firstPage.data];

      for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
        params.set("page", String(page));
        const nextPage = await loadCommentPage(params, loadFailed);
        comments.push(...nextPage.data);
      }

      return {
        target,
        data: {
          comments,
          hiddenCount: firstPage.meta.hiddenCount,
          viewer: firstPage.meta.viewer,
        },
      };
    }),
  );

  return commentTargetEntriesResult({
    entries: loadedEntries,
    showAllTargets,
    targets,
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
