import type {
  CommentStatus,
  CommentVisibility,
} from "@/generated/prisma/client";

export type CommentAttachmentAccessComment = {
  status: CommentStatus;
  userId: string | null;
  visibility: CommentVisibility;
};

export type CommentAttachmentAccessViewer = {
  isAdmin: boolean;
  isAuthenticated: boolean;
  userId: string | null;
};

export function canViewerAccessCommentAttachment(
  comment: CommentAttachmentAccessComment,
  viewer: CommentAttachmentAccessViewer,
) {
  if (!viewer.isAuthenticated) return false;
  if (comment.status === "deleted") return false;
  if (comment.status === "softbanned") {
    return viewer.isAdmin || comment.userId === viewer.userId;
  }
  return (
    comment.visibility === "public" ||
    comment.visibility === "logged_in_only" ||
    comment.visibility === "anonymous"
  );
}
