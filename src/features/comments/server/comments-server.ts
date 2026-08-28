import { getViewerContext } from "@/lib/auth/viewer-context";
import { loadCommentThread } from "./comment-read-model";
import {
  countCommentStageQuery,
  createCommentStageCounter,
  observeCommentStage,
} from "./comment-stage-analytics";
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
  const viewerStageCounter = createCommentStageCounter({
    dbContext: "none",
    dbLabel: "app",
  });
  const viewer = await observeCommentStage({
    counter: viewerStageCounter,
    stage: "viewer.context",
    work: () =>
      viewerOverride
        ? Promise.resolve(viewerOverride)
        : getViewerContext({
            includeAdmin: false,
            instrumentation: {
              onQuery: () => countCommentStageQuery(viewerStageCounter),
            },
          }),
  });
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
    viewerContextStageRecorded: true,
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
