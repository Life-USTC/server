import type { CommentTargetType } from "./comment-utils";

/**
 * Verify that a target entity actually exists in the DB.
 * Prevents orphan comments pointing at deleted or nonexistent entities.
 */
export async function verifyCommentTargetEntity(
  targetType: CommentTargetType,
  whereTarget: Record<string, number | string>,
): Promise<boolean> {
  const { prisma } = await import("@/lib/db/prisma");
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
