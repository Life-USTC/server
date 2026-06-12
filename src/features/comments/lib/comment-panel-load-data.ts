import {
  type CommentNodeWithContext,
  type CommentTargetOption,
  withCommentContext,
} from "@/features/comments/lib/comment-ui";
import type { CommentNode } from "@/features/comments/server/comment-types";
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
      const response = await fetch(`/api/comments?${params.toString()}`);
      if (!response.ok) throw new Error(loadFailed);
      const parsed = commentsListResponseSchema.safeParse(
        await response.json(),
      );
      if (!parsed.success) throw new Error(loadFailed);
      return { target, data: parsed.data };
    }),
  );

  return commentTargetEntriesResult({
    entries: loadedEntries,
    showAllTargets,
    targets,
  });
}
