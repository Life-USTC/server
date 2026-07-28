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

  const pageSize = options.pageSize;
  const result = await loadCommentThread({
    pagination: pageSize ? { pageSize, skip: 0 } : undefined,
    target: resolvedTarget,
    viewer,
    viewerUserId: viewer.userId,
  });
  return {
    comments: result.comments,
    complete: pageSize === undefined || result.total <= pageSize,
    hiddenCount: result.hiddenCount,
    viewer: result.viewer,
  };
}
