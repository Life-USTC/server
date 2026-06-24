import type {
  CommentStatus,
  CommentVisibility,
} from "@/generated/prisma/client";

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
  if (comment.visibility === "logged_in_only" && !viewer.isAuthenticated) {
    return false;
  }
  return true;
}
