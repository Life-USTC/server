import { SUSPENSION_DURATION_OPTIONS } from "@/features/admin/constants";

type ModerationTab = "comments" | "descriptions" | "homeworks" | "suspensions";

type ModerationCopy = Record<string, string>;

export function buildModerationTabs(
  copy: ModerationCopy,
  counts: Record<ModerationTab, number>,
) {
  return [
    ["comments", copy.commentsTab, counts.comments],
    ["descriptions", copy.descriptionsTab, counts.descriptions],
    ["homeworks", copy.homeworksTab, counts.homeworks],
    ["suspensions", copy.suspensionsTab, counts.suspensions],
  ] satisfies Array<readonly [ModerationTab, string, number]>;
}

export function buildCommentStatusOptions(copy: ModerationCopy) {
  return [
    ["active", copy.statusActive],
    ["softbanned", copy.statusSoftbanned],
    ["deleted", copy.statusDeleted],
  ] as const;
}

export function buildStatusFilterOptions(copy: ModerationCopy) {
  return [
    { value: "all", label: copy.filterAll },
    { value: "active", label: copy.filterActive },
    { value: "softbanned", label: copy.filterSoftbanned },
    { value: "deleted", label: copy.filterDeleted },
    { value: "suspended", label: copy.filterSuspended },
  ];
}

export function buildDescriptionTargetOptions(copy: ModerationCopy) {
  return [
    { value: "all", label: copy.descriptionTargetAll },
    { value: "homework", label: copy.descriptionTargetHomework },
    { value: "course", label: copy.descriptionTargetCourse },
    { value: "section", label: copy.descriptionTargetSection },
    { value: "teacher", label: copy.descriptionTargetTeacher },
  ];
}

export function buildDescriptionContentOptions(copy: ModerationCopy) {
  return [
    { value: "withContent", label: copy.descriptionContentWith },
    { value: "empty", label: copy.descriptionContentEmpty },
    { value: "all", label: copy.filterAll },
  ];
}

export function buildSuspensionDurationOptions(copy: ModerationCopy) {
  return SUSPENSION_DURATION_OPTIONS.map((option) => ({
    value: option.value,
    label: copy[option.labelKey],
  }));
}
