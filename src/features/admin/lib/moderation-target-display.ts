import type {
  ModerationCommentLike,
  ModerationCopy,
  ModerationDescriptionLike,
} from "@/features/admin/lib/moderation-display-types";
import {
  commentPermalinkHref,
  commentTargetPermalinkBaseHref,
} from "@/features/comments/lib/comment-panel-links";

export function visibleModerationComments<T extends ModerationCommentLike>(
  comments: T[],
  searchQuery: string,
) {
  const needle = searchQuery.trim().toLowerCase();
  if (!needle) return comments;
  return comments.filter((comment) =>
    [
      comment.body,
      comment.user?.name,
      comment.user?.username,
      comment.course?.code,
      comment.course?.nameCn,
      comment.section?.code,
      comment.section?.course?.nameCn,
      comment.teacher?.nameCn,
      comment.homework?.title,
      comment.sectionTeacher?.section?.code,
      comment.sectionTeacher?.section?.course?.nameCn,
      comment.sectionTeacher?.teacher?.nameCn,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)),
  );
}

export function moderationTargetLabel(
  item: ModerationCommentLike | ModerationDescriptionLike,
  copy: ModerationCopy,
) {
  if (item.sectionTeacher) {
    const label = [
      item.sectionTeacher.section?.course?.nameCn,
      item.sectionTeacher.section?.code,
      item.sectionTeacher.teacher?.nameCn,
    ]
      .filter(Boolean)
      .join(" · ");
    return label || copy.unknownTarget;
  }
  if (item.section)
    return `${item.section.course?.nameCn ?? copy.descriptionTargetSection} ${item.section.code}`;
  if (item.course) return `${item.course.nameCn} ${item.course.code}`;
  if (item.teacher) return item.teacher.nameCn;
  if (item.homework) return item.homework.title;
  return copy.unknownTarget;
}

export function moderationTargetHref(comment: ModerationCommentLike) {
  if (comment.sectionTeacher?.section?.jwId)
    return commentPermalinkHref(
      commentTargetPermalinkBaseHref({
        sectionJwId: comment.sectionTeacher.section.jwId,
        type: "section-teacher",
      }),
      String(comment.id),
    );
  if (comment.section?.jwId)
    return commentPermalinkHref(
      commentTargetPermalinkBaseHref({
        sectionJwId: comment.section.jwId,
        type: "section",
      }),
      String(comment.id),
    );
  if (comment.course?.jwId)
    return commentPermalinkHref(
      commentTargetPermalinkBaseHref({
        courseJwId: comment.course.jwId,
        type: "course",
      }),
      String(comment.id),
    );
  if (comment.teacher?.id)
    return commentPermalinkHref(
      commentTargetPermalinkBaseHref({
        teacherId: comment.teacher.id,
        type: "teacher",
      }),
      String(comment.id),
    );
  if (comment.homework?.id && comment.homework.section?.jwId) {
    return commentPermalinkHref(
      commentTargetPermalinkBaseHref({
        homeworkId: comment.homework.id,
        sectionJwId: comment.homework.section.jwId,
        type: "homework",
      }),
      String(comment.id),
    );
  }
  return `/community/comments/${comment.id}`;
}

export function moderationDescriptionTargetHref(
  description: ModerationDescriptionLike,
) {
  if (description.homework?.section?.jwId) {
    return `/catalog/sections/${description.homework.section.jwId}/homework#homework-${description.homework.id}`;
  }
  if (description.section?.jwId)
    return `/catalog/sections/${description.section.jwId}/introduction`;
  if (description.course?.jwId)
    return `/catalog/courses/${description.course.jwId}/introduction`;
  if (description.teacher?.id)
    return `/catalog/teachers/${description.teacher.id}/introduction`;
  if (description.homework?.id) return "/admin/moderation?tab=homeworks";
  return "/admin/moderation?tab=descriptions";
}

export function moderationDescriptionEditedAt(
  description: ModerationDescriptionLike,
) {
  return description.lastEditedAt ?? description.updatedAt;
}

export function moderationCommentAuthorLabel(
  comment: ModerationCommentLike,
  guestLabel: string,
) {
  if (comment.user) {
    return (
      comment.user.name ??
      comment.user.username ??
      comment.user.id ??
      guestLabel
    );
  }
  return comment.authorName ?? guestLabel;
}
