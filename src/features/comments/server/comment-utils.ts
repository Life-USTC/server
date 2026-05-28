import { parseInteger } from "@/lib/api/helpers";
import { prisma } from "@/lib/db/prisma";

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

export async function resolveSectionTeacherId(
  sectionId: number,
  teacherId: number,
) {
  const section = await prisma.section.findFirst({
    where: {
      id: sectionId,
      teachers: {
        some: { id: teacherId },
      },
    },
    select: { id: true },
  });

  if (!section) return null;

  const sectionTeacher = await prisma.sectionTeacher.upsert({
    where: {
      sectionId_teacherId: {
        sectionId,
        teacherId,
      },
    },
    update: {},
    create: { sectionId, teacherId },
  });

  return sectionTeacher.id as number;
}

/**
 * Verify that a target entity actually exists in the DB.
 * Prevents orphan comments pointing at deleted or nonexistent entities.
 */
async function verifyTargetEntity(
  targetType: CommentTargetType,
  whereTarget: Record<string, number | string>,
): Promise<boolean> {
  if (targetType === "section" && typeof whereTarget.sectionId === "number") {
    const section = await prisma.section.findUnique({
      where: { id: whereTarget.sectionId },
      select: { id: true },
    });
    return section !== null;
  }
  if (targetType === "course" && typeof whereTarget.courseId === "number") {
    const course = await prisma.course.findUnique({
      where: { id: whereTarget.courseId },
      select: { id: true },
    });
    return course !== null;
  }
  if (targetType === "teacher" && typeof whereTarget.teacherId === "number") {
    const teacher = await prisma.teacher.findUnique({
      where: { id: whereTarget.teacherId },
      select: { id: true },
    });
    return teacher !== null;
  }
  if (targetType === "homework" && typeof whereTarget.homeworkId === "string") {
    const homework = await prisma.homework.findUnique({
      where: { id: whereTarget.homeworkId },
      select: { id: true },
    });
    return homework !== null;
  }
  if (
    targetType === "section-teacher" &&
    typeof whereTarget.sectionTeacherId === "number"
  ) {
    const st = await prisma.sectionTeacher.findUnique({
      where: { id: whereTarget.sectionTeacherId },
      select: { id: true },
    });
    return st !== null;
  }
  return true;
}

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
      ? await verifyTargetEntity(input.targetType, whereTarget)
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
