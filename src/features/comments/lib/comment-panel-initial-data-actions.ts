import type { ViewerContext } from "@/lib/auth/viewer-context";
import {
  type CommentsInitialData,
  commentsFromInitialData,
} from "./comment-panel-data";
import type { CommentNodeWithContext, CommentTargetOption } from "./comment-ui";

export function createCommentPanelInitialDataActions(input: {
  getResolvedTargets: () => CommentTargetOption[];
  getShowAllTargets: () => boolean;
  setComments: (value: CommentNodeWithContext[]) => void;
  setHiddenCount: (value: number) => void;
  setLoading: (value: boolean) => void;
  setViewer: (value: ViewerContext) => void;
}) {
  function applyInitialData(data: CommentsInitialData) {
    const result = commentsFromInitialData({
      data,
      showAllTargets: input.getShowAllTargets(),
      targets: input.getResolvedTargets(),
    });
    input.setComments(result.comments);
    input.setHiddenCount(result.hiddenCount);
    input.setViewer(result.viewer);
    input.setLoading(false);
  }

  return { applyInitialData };
}
