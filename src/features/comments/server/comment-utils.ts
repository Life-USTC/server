import { parseInteger } from "@/lib/api/helpers";
import { resolveSectionTeacherId } from "./comment-section-teacher";
import { verifyCommentTargetEntity } from "./comment-target-verification";

export type CommentTargetType =
  | "section"
  | "course"
  | "teacher"
  | "section-teacher"
  | "homework";

export type ResolvedCommentTarget = {
  homeworkId: string | null;
  sectionId: number | null;
  sectionTeacherId: number | null;
  targetId: number | string | null;
  teacherId: number | null;
  whereTarget: Record<string, number | string>;
  /** True when the underlying target entity was verified to exist in the DB. */
  verified: boolean;
};

export { resolveSectionTeacherId };

export async function resolveCommentTarget(input: {
  allowDirectSectionTeacherId?: boolean;
  /** Whether to verify the target entity exists in the DB before returning. */
  verifyExistence?: boolean;
  rawTargetId: unknown;
  sectionId?: unknown;
  targetType: CommentTargetType;
  teacherId?: unknown;
}): Promise<ResolvedCommentTarget | null> {
  const normalizedTargetId = parseInteger(input.rawTargetId);
  const homeworkId =
    typeof input.rawTargetId === "string" && input.rawTargetId.trim().length > 0
      ? input.rawTargetId.trim()
      : null;
  const sectionId = parseInteger(input.sectionId);
  const teacherId = parseInteger(input.teacherId);

  let whereTarget: Record<string, number | string> | null = null;
  let sectionTeacherId: number | null = null;

  if (input.targetType === "section" && normalizedTargetId) {
    whereTarget = { sectionId: normalizedTargetId };
  } else if (input.targetType === "course" && normalizedTargetId) {
    whereTarget = { courseId: normalizedTargetId };
  } else if (input.targetType === "teacher" && normalizedTargetId) {
    whereTarget = { teacherId: normalizedTargetId };
  } else if (input.targetType === "homework" && homeworkId) {
    whereTarget = { homeworkId };
  } else if (input.targetType === "section-teacher") {
    if (input.allowDirectSectionTeacherId && normalizedTargetId) {
      sectionTeacherId = normalizedTargetId;
    } else if (sectionId && teacherId) {
      sectionTeacherId = await resolveSectionTeacherId(sectionId, teacherId);
    }

    if (sectionTeacherId) {
      whereTarget = { sectionTeacherId };
    }
  }

  if (!whereTarget) {
    return null;
  }

  const verified =
    input.verifyExistence === true
      ? await verifyCommentTargetEntity(input.targetType, whereTarget)
      : true;

  return {
    homeworkId,
    sectionId,
    sectionTeacherId,
    targetId: input.targetType === "homework" ? homeworkId : normalizedTargetId,
    teacherId,
    whereTarget,
    verified,
  };
}
