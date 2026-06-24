import { prisma } from "@/lib/db/prisma";
import type { CommentTargetLookupRecord } from "./comment-read-model";
import type { CommentTargetType, ResolvedCommentTarget } from "./comment-utils";

type CommentTargetCourseMetadata = {
  jwId: number | null;
  nameCn: string | null;
};

type CommentTargetSectionMetadata = {
  code: string | null;
  course?: CommentTargetCourseMetadata | null;
  jwId: number | null;
};

type CommentTargetMetadataSource = {
  course?: CommentTargetCourseMetadata | null;
  homework?: {
    section?: Pick<CommentTargetSectionMetadata, "code" | "jwId"> | null;
    title: string | null;
  } | null;
  section?: CommentTargetSectionMetadata | null;
  sectionTeacher?: {
    section?: CommentTargetSectionMetadata | null;
    sectionId: number | null;
    teacher?: { nameCn: string | null } | null;
    teacherId: number | null;
  } | null;
  teacher?: { nameCn: string | null } | null;
};

const emptyPublicCommentTargetMetadataFields = {
  courseJwId: null,
  courseName: null,
  homeworkSectionCode: null,
  homeworkSectionJwId: null,
  homeworkTitle: null,
  sectionCode: null,
  sectionJwId: null,
  sectionTeacherCourseJwId: null,
  sectionTeacherCourseName: null,
  sectionTeacherSectionCode: null,
  sectionTeacherSectionId: null,
  sectionTeacherSectionJwId: null,
  sectionTeacherTeacherId: null,
  sectionTeacherTeacherName: null,
  teacherName: null,
} as const;

function publicCommentTargetMetadataPayload(
  source: CommentTargetMetadataSource | null | undefined,
) {
  const course = source?.course ?? source?.section?.course ?? null;

  return {
    ...emptyPublicCommentTargetMetadataFields,
    courseJwId: course?.jwId ?? null,
    courseName: course?.nameCn ?? null,
    homeworkSectionCode: source?.homework?.section?.code ?? null,
    homeworkSectionJwId: source?.homework?.section?.jwId ?? null,
    homeworkTitle: source?.homework?.title ?? null,
    sectionCode: source?.section?.code ?? null,
    sectionJwId: source?.section?.jwId ?? null,
    sectionTeacherCourseJwId:
      source?.sectionTeacher?.section?.course?.jwId ?? null,
    sectionTeacherCourseName:
      source?.sectionTeacher?.section?.course?.nameCn ?? null,
    sectionTeacherSectionCode: source?.sectionTeacher?.section?.code ?? null,
    sectionTeacherSectionId: source?.sectionTeacher?.sectionId ?? null,
    sectionTeacherSectionJwId: source?.sectionTeacher?.section?.jwId ?? null,
    sectionTeacherTeacherId: source?.sectionTeacher?.teacherId ?? null,
    sectionTeacherTeacherName: source?.sectionTeacher?.teacher?.nameCn ?? null,
    teacherName: source?.teacher?.nameCn ?? null,
  };
}

function baseCommentListTargetPayload(
  targetType: CommentTargetType,
  target: ResolvedCommentTarget,
) {
  return {
    type: targetType,
    targetId: target.targetId,
    sectionId: target.sectionId,
    teacherId: target.teacherId,
    sectionTeacherId: target.sectionTeacherId,
    homeworkId: target.homeworkId,
  };
}

export async function commentListTargetPayload(
  targetType: CommentTargetType,
  target: ResolvedCommentTarget,
) {
  const base = {
    ...baseCommentListTargetPayload(targetType, target),
    courseId:
      typeof target.whereTarget.courseId === "number"
        ? target.whereTarget.courseId
        : null,
  };

  if (
    targetType === "section" &&
    typeof target.whereTarget.sectionId === "number"
  ) {
    const section = await prisma.section.findUnique({
      where: { id: target.whereTarget.sectionId },
      select: {
        code: true,
        jwId: true,
        course: { select: { jwId: true, nameCn: true } },
      },
    });
    return {
      ...base,
      ...publicCommentTargetMetadataPayload({ section }),
    };
  }

  if (
    targetType === "course" &&
    typeof target.whereTarget.courseId === "number"
  ) {
    const course = await prisma.course.findUnique({
      where: { id: target.whereTarget.courseId },
      select: { jwId: true, nameCn: true },
    });
    return {
      ...base,
      ...publicCommentTargetMetadataPayload({ course }),
    };
  }

  if (
    targetType === "teacher" &&
    typeof target.whereTarget.teacherId === "number"
  ) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: target.whereTarget.teacherId },
      select: { nameCn: true },
    });
    return {
      ...base,
      ...publicCommentTargetMetadataPayload({ teacher }),
    };
  }

  if (targetType === "homework" && target.homeworkId) {
    const homework = await prisma.homework.findUnique({
      where: { id: target.homeworkId },
      select: {
        title: true,
        section: { select: { jwId: true, code: true } },
      },
    });
    return {
      ...base,
      ...publicCommentTargetMetadataPayload({ homework }),
    };
  }

  if (targetType === "section-teacher") {
    if (target.sectionTeacherId) {
      const sectionTeacher = await prisma.sectionTeacher.findUnique({
        where: { id: target.sectionTeacherId },
        select: {
          sectionId: true,
          teacherId: true,
          section: {
            select: {
              jwId: true,
              code: true,
              course: { select: { jwId: true, nameCn: true } },
            },
          },
          teacher: { select: { nameCn: true } },
        },
      });
      return {
        ...base,
        ...publicCommentTargetMetadataPayload({ sectionTeacher }),
      };
    }

    if (target.sectionId && target.teacherId) {
      const [section, teacher] = await Promise.all([
        prisma.section.findUnique({
          where: { id: target.sectionId },
          select: {
            jwId: true,
            code: true,
            course: { select: { jwId: true, nameCn: true } },
          },
        }),
        prisma.teacher.findUnique({
          where: { id: target.teacherId },
          select: { nameCn: true },
        }),
      ]);
      return {
        ...base,
        ...publicCommentTargetMetadataPayload({
          sectionTeacher: {
            section,
            sectionId: target.sectionId,
            teacher,
            teacherId: target.teacherId,
          },
        }),
      };
    }
  }

  return {
    ...base,
    ...publicCommentTargetMetadataPayload(null),
  };
}

export function commentThreadTargetPayload(comment: CommentTargetLookupRecord) {
  return {
    sectionId: comment.sectionId ?? null,
    courseId: comment.courseId ?? null,
    teacherId: comment.teacherId ?? null,
    sectionTeacherId: comment.sectionTeacherId ?? null,
    homeworkId: comment.homework?.id ?? null,
    ...publicCommentTargetMetadataPayload(comment),
  };
}
