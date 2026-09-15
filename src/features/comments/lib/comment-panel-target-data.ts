import {
  type CommentTargetOption,
  type CommentTargetType,
  commentTargetLabel,
} from "@/features/comments/lib/comment-ui";

export function resolveCommentTargets({
  copy,
  permalinkBaseHref,
  sectionId,
  targetId,
  targets,
  targetType,
  teacherId,
  youngId,
}: {
  copy: {
    tabCourse: string;
    tabSection: string;
    tabSectionTeacher: string;
    tabTeacher: string;
    tabYoungEvent?: string;
  };
  permalinkBaseHref?: string | null;
  sectionId: number | null;
  targetId: number | string | null;
  targets: CommentTargetOption[];
  targetType: CommentTargetType;
  teacherId: number | null;
  youngId?: string | null;
}) {
  if (targets.length > 0) return targets;
  return [
    {
      key: targetType,
      label: commentTargetLabel(targetType, copy),
      permalinkBaseHref: permalinkBaseHref ?? undefined,
      sectionId: sectionId ?? undefined,
      targetId,
      teacherId,
      type: targetType,
      youngId,
    },
  ];
}

export function commentPostTargetOptions(targets: CommentTargetOption[]) {
  return targets.map((target) => ({
    value: target.key,
    label: target.label,
  }));
}

export function selectedCommentTarget(
  targets: CommentTargetOption[],
  selectedKey: string,
) {
  return (
    targets.find((target) => target.key === selectedKey) ?? targets[0] ?? null
  );
}

export function commentTargetPayload(
  fallbackType: CommentTargetType,
  target: CommentTargetOption | null,
) {
  return {
    targetType: target?.type ?? fallbackType,
    targetId:
      target?.type === "young-event"
        ? undefined
        : (target?.targetId ?? undefined),
    sectionId: target?.sectionId ?? undefined,
    teacherId: target?.teacherId ?? undefined,
    youngId:
      target?.type === "young-event"
        ? (target.youngId ?? undefined)
        : undefined,
  };
}
