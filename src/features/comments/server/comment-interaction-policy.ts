import type {
  CommentStatus,
  CommentVisibility,
} from "@/generated/prisma/client";
import { isLoggedInOnlyCommentVisibleToViewer } from "./comment-visibility-policy";

type CommentInteractionComment = {
  status: CommentStatus | string;
  visibility: CommentVisibility | string;
};

type CommentInteractionViewer = {
  isAuthenticated: boolean;
  isSuspended: boolean;
};

export function canViewerWriteCommentInteraction(
  comment: CommentInteractionComment,
  viewer: CommentInteractionViewer,
) {
  if (!viewer.isAuthenticated || viewer.isSuspended) return false;
  if (comment.status !== "active") return false;
  if (!isLoggedInOnlyCommentVisibleToViewer(comment.visibility, viewer)) {
    return false;
  }
  return true;
}
