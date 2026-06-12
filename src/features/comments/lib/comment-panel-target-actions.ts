import { selectedCommentTarget } from "./comment-panel-data";
import type { CommentNodeWithContext, CommentTargetOption } from "./comment-ui";

export function createCommentPanelTargetActions(input: {
  getPostTargetKey: () => string;
  getResolvedTargets: () => CommentTargetOption[];
}) {
  function selectedPostTarget() {
    return selectedCommentTarget(
      input.getResolvedTargets(),
      input.getPostTargetKey(),
    );
  }

  function commentTarget(comment: CommentNodeWithContext) {
    return (
      input
        .getResolvedTargets()
        .find((target) => target.key === comment.contextKey) ??
      selectedPostTarget()
    );
  }

  return {
    commentTarget,
    selectedPostTarget,
  };
}
