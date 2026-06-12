import type {
  ModerationCommentLike,
  ModerationCopy,
  ModerationDescriptionLike,
} from "@/features/admin/lib/moderation-display-types";

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
  const anchor = `#comment-${comment.id}`;
  if (comment.sectionTeacher?.section?.jwId)
    return `/sections/${comment.sectionTeacher.section.jwId}${anchor}`;
  if (comment.section?.jwId)
    return `/sections/${comment.section.jwId}${anchor}`;
  if (comment.course?.jwId) return `/courses/${comment.course.jwId}${anchor}`;
  if (comment.teacher?.id) return `/teachers/${comment.teacher.id}${anchor}`;
  if (comment.homework?.id) return `/comments/${comment.id}`;
  return `/comments/${comment.id}`;
}

export function moderationDescriptionTargetHref(
  description: ModerationDescriptionLike,
) {
  if (description.homework?.section?.jwId) {
    return `/sections/${description.homework.section.jwId}#homework-${description.homework.id}`;
  }
  if (description.section?.jwId) return `/sections/${description.section.jwId}`;
  if (description.course?.jwId) return `/courses/${description.course.jwId}`;
  if (description.teacher?.id) return `/teachers/${description.teacher.id}`;
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
