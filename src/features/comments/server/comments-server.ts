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
  hiddenCount: number;
  viewer: CommentViewer;
};

export async function getCommentsPayload(
  target: CommentTarget,
  viewerOverride?: CommentViewer,
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
    return { comments: [], hiddenCount: 0, viewer };
  }

  return loadCommentThread({
    target: resolvedTarget,
    viewer,
    viewerUserId: viewer.userId,
  });
}
