import type { CommentTargetType } from "@/features/comments/lib/comment-ui-types";
import type { CommentNode } from "@/features/comments/server/comment-types";

export function commentTargetLabel(
  type: CommentTargetType,
  copy: {
    tabCourse: string;
    tabSection: string;
    tabSectionTeacher: string;
    tabTeacher: string;
  },
) {
  if (type === "course") return copy.tabCourse;
  if (type === "teacher") return copy.tabTeacher;
  if (type === "section-teacher") return copy.tabSectionTeacher;
  return copy.tabSection;
}

export function commentAuthorName(
  comment: CommentNode,
  anonymousLabel: string,
) {
  if (comment.authorHidden) return anonymousLabel;
  return comment.author?.name ?? anonymousLabel;
}

export function commentAuthorInitials(
  comment: CommentNode,
  anonymousLabel: string,
) {
  return commentAuthorName(comment, anonymousLabel).slice(0, 2).toUpperCase();
}

export function formatUploadSize(value: number | undefined) {
  if (!value || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 102.4) / 10} KB`;
  return `${Math.round(value / 1024 / 102.4) / 10} MB`;
}
