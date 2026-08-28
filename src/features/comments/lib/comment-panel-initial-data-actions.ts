import type { ViewerContext } from "@/lib/auth/viewer-context";
import {
  type CommentsInitialData,
  type CommentTargetLoadState,
  commentsFromInitialData,
} from "./comment-panel-data";
import { commentTargetCanLoad } from "./comment-panel-target-loading";
import type { CommentNodeWithContext, CommentTargetOption } from "./comment-ui";

export function createCommentPanelInitialDataActions(input: {
  getResolvedTargets: () => CommentTargetOption[];
  getShowAllTargets: () => boolean;
  setComments: (value: CommentNodeWithContext[]) => void;
  setHiddenCount: (value: number) => void;
  setLoading: (value: boolean) => void;
  setTargetLoadStates: (value: CommentTargetLoadState[]) => void;
  setViewer: (value: ViewerContext) => void;
}) {
  function applyInitialData(data: CommentsInitialData) {
    const targets = input.getResolvedTargets();
    const result = commentsFromInitialData({
      data,
      showAllTargets: input.getShowAllTargets(),
      targets,
    });
    const primaryTarget = targets.find(commentTargetCanLoad);
    input.setTargetLoadStates(
      targets.map((target) => {
        const loaded = target.key === primaryTarget?.key;
        return {
          comments: loaded ? (result.targetComments[target.key] ?? []) : [],
          hiddenCount: loaded
            ? (data.hiddenMap?.[target.key] ?? data.hiddenCount)
            : 0,
          loaded,
          page: loaded ? 1 : 0,
          target,
          total: loaded ? (result.targetComments[target.key]?.length ?? 0) : 0,
          totalPages: loaded ? 1 : 0,
        };
      }),
    );
    input.setComments(result.comments);
    input.setHiddenCount(result.hiddenCount);
    input.setViewer(result.viewer);
    input.setLoading(false);
  }

  return { applyInitialData };
}
