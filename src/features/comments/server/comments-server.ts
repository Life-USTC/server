import { getViewerContext } from "@/lib/auth/viewer-context";
import { loadCommentThread } from "./comment-read-model";
import type {
  CommentNode,
  CommentTarget,
  CommentViewer,
} from "./comment-types";
import { resolveCommentTarget } from "./comment-utils";

type CommentsPayload = {
  comments: CommentNode[];
  complete: boolean;
  hiddenCount: number;
  viewer: CommentViewer;
};

export async function getCommentsPayload(
  target: CommentTarget,
  viewerOverride?: CommentViewer,
  options: { pageSize?: number } = {},
): Promise<CommentsPayload> {
  const viewer =
    viewerOverride ?? (await getViewerContext({ includeAdmin: false }));
  const resolvedTarget = await resolveCommentTarget({
    allowDirectSectionTeacherId: true,
    rawTargetId:
      target.type === "homework"
        ? (target.homeworkId ?? target.targetId)
        : (target.sectionTeacherId ?? target.targetId),
    sectionId: target.sectionId,
    targetType: target.type,
    teacherId: target.teacherId,
  });

  if (!resolvedTarget) {
    return { comments: [], complete: true, hiddenCount: 0, viewer };
  }

  const pageSize = options.pageSize ?? 20;
  const result = await loadCommentThread({
    pagination: { pageSize, skip: 0 },
    target: resolvedTarget,
    viewer,
    viewerUserId: viewer.userId,
  });
  return {
    comments: result.comments,
    complete:
      result.total <= pageSize && !hasReplyContinuation(result.comments),
    hiddenCount: result.hiddenCount,
    viewer: result.viewer,
  };
}

function hasReplyContinuation(comments: CommentNode[]): boolean {
  return comments.some(
    (comment) =>
      comment.repliesNextCursor !== null ||
      hasReplyContinuation(comment.replies),
  );
}
