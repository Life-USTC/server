import {
  type CommentTargetOption,
  type CommentTargetType,
  commentTargetLabel,
} from "@/features/comments/lib/comment-ui";

export function resolveCommentTargets({
  copy,
  sectionId,
  targetId,
  targets,
  targetType,
  teacherId,
}: {
  copy: {
    tabCourse: string;
    tabSection: string;
    tabSectionTeacher: string;
    tabTeacher: string;
  };
  sectionId: number | null;
  targetId: number | string | null;
  targets: CommentTargetOption[];
  targetType: CommentTargetType;
  teacherId: number | null;
}) {
  if (targets.length > 0) return targets;
  return [
    {
      key: targetType,
      label: commentTargetLabel(targetType, copy),
      sectionId: sectionId ?? undefined,
      targetId,
      teacherId,
      type: targetType,
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
    targetId: target?.targetId ?? undefined,
    sectionId: target?.sectionId ?? undefined,
    teacherId: target?.teacherId ?? undefined,
  };
}
