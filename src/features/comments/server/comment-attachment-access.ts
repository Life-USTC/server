import type {
  CommentStatus,
  CommentVisibility,
} from "@/generated/prisma/client";
import {
  type CommentVisibilityViewer,
  canViewerAccessCommentAttachment as canViewerAccessCommentAttachmentByPolicy,
} from "./comment-visibility-policy";

export type CommentAttachmentAccessComment = {
  status: CommentStatus;
  userId: string | null;
  visibility: CommentVisibility;
};

export type CommentAttachmentAccessViewer = CommentVisibilityViewer;

export function canViewerAccessCommentAttachment(
  comment: CommentAttachmentAccessComment,
  viewer: CommentAttachmentAccessViewer,
) {
  return canViewerAccessCommentAttachmentByPolicy(comment, viewer);
}
