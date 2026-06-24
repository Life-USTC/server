export const COMMENT_TARGET_TYPES = [
  "section",
  "course",
  "teacher",
  "section-teacher",
  "homework",
] as const;

export type CommentTargetType = (typeof COMMENT_TARGET_TYPES)[number];
