export const DESCRIPTION_TARGET_TYPES = [
  "section",
  "course",
  "teacher",
  "homework",
] as const;

export type DescriptionTargetType = (typeof DESCRIPTION_TARGET_TYPES)[number];
