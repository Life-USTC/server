import { prisma } from "@/lib/db/prisma";
import { parseInteger } from "@/lib/integers";
import {
  type CommentStageCounter,
  countCommentStageQuery,
} from "./comment-stage-analytics";
import type {
  CommentTargetReferenceInput,
  ResolvedCommentTargetReference,
} from "./comment-target-types";
import {
  invalidTarget,
  targetNotFound,
} from "./comment-target-verify-resolution";
import {
  type CommentTargetMetadataSource,
  resolveCommentTarget,
} from "./comment-utils";

type SectionTargetMetadataRow = {
  code: string;
  course: { jwId: number; nameCn: string };
  id: number;
  jwId: number;
};

type SectionTeacherTargetMetadataRow = {
  code: string;
  course: { jwId: number; nameCn: string };
  id: number;
  jwId: number;
};

type SectionTeacherListSection = SectionTeacherTargetMetadataRow & {
  sectionTeachers: { id: number }[];
  teachers: { id: number; nameCn: string }[];
};

function sectionMetadata(
  section: SectionTargetMetadataRow | SectionTeacherTargetMetadataRow,
): CommentTargetMetadataSource {
  return {
    section: {
      code: section.code,
      course: section.course,
      jwId: section.jwId,
    },
  };
}

function sectionTeacherMetadata(input: {
  section: SectionTeacherTargetMetadataRow;
  teacher: { nameCn: string };
  sectionId: number;
  teacherId: number;
}): CommentTargetMetadataSource {
  return {
    sectionTeacher: {
      section: {
        code: input.section.code,
        course: input.section.course,
        jwId: input.section.jwId,
      },
      sectionId: input.sectionId,
      teacher: input.teacher,
      teacherId: input.teacherId,
    },
  };
}

async function resolveSectionTeacherListTarget(
  section: SectionTeacherListSection | null,
  notFoundTargetId: number,
  teacherId: number,
): Promise<ResolvedCommentTargetReference> {
  if (!section) return targetNotFound("section", notFoundTargetId);

  const teacher = section.teachers[0];
  if (!teacher) return targetNotFound("section-teacher", notFoundTargetId);

  const sectionTeacher = section.sectionTeachers[0];
  if (sectionTeacher) {
    const target = await resolveCommentTarget({
      allowDirectSectionTeacherId: true,
      rawTargetId: sectionTeacher.id,
      sectionId: section.id,
      teacherId,
      targetType: "section-teacher",
      verifyExistence: false,
    });
    if (!target) return invalidTarget("section-teacher");
    return {
      ok: true,
      target: {
        ...target,
        sectionId: section.id,
        sectionTeacherId: sectionTeacher.id,
        teacherId,
        targetId: null,
        targetMetadata: sectionTeacherMetadata({
          section,
          sectionId: section.id,
          teacher,
          teacherId,
        }),
      },
      targetType: "section-teacher",
    };
  }

  return {
    ok: true,
    target: {
      empty: true,
      homeworkId: null,
      sectionId: section.id,
      sectionTeacherId: null,
      targetId: null,
      teacherId,
      verified: true,
      whereTarget: { sectionTeacherId: -1 },
      targetMetadata: sectionTeacherMetadata({
        section,
        sectionId: section.id,
        teacher,
        teacherId,
      }),
    },
    targetType: "section-teacher",
  };
}

export async function resolveCommentListTargetReference(
  input: CommentTargetReferenceInput,
  sectionJwId: number | null,
  courseJwId: number | null,
  counter: CommentStageCounter,
): Promise<ResolvedCommentTargetReference | null> {
  if (input.targetType === "section" && sectionJwId) {
    countCommentStageQuery(counter);
    const section = await prisma.section.findUnique({
      where: { jwId: sectionJwId },
      select: {
        code: true,
        course: { select: { jwId: true, nameCn: true } },
        id: true,
        jwId: true,
      },
    });
    if (!section) return targetNotFound("section", sectionJwId);
    const target = await resolveCommentTarget({
      rawTargetId: section.id,
      sectionId: input.sectionId,
      teacherId: input.teacherId,
      targetType: "section",
      verifyExistence: false,
    });
    if (!target) return invalidTarget("section");
    return {
      ok: true,
      target: { ...target, targetMetadata: sectionMetadata(section) },
      targetType: "section",
    };
  }

  if (input.targetType === "section" && parseInteger(input.rawTargetId)) {
    const targetId = parseInteger(input.rawTargetId);
    countCommentStageQuery(counter);
    const section = await prisma.section.findUnique({
      where: { id: targetId as number },
      select: {
        code: true,
        course: { select: { jwId: true, nameCn: true } },
        id: true,
        jwId: true,
      },
    });
    if (!section) return targetNotFound("section", input.rawTargetId);
    const target = await resolveCommentTarget({
      rawTargetId: section.id,
      sectionId: input.sectionId,
      teacherId: input.teacherId,
      targetType: "section",
      verifyExistence: false,
    });
    if (!target) return invalidTarget("section");
    return {
      ok: true,
      target: { ...target, targetMetadata: sectionMetadata(section) },
      targetType: "section",
    };
  }

  if (input.targetType === "course" && courseJwId) {
    countCommentStageQuery(counter);
    const course = await prisma.course.findUnique({
      where: { jwId: courseJwId },
      select: { id: true, jwId: true, nameCn: true },
    });
    if (!course) return targetNotFound("course", courseJwId);
    const target = await resolveCommentTarget({
      rawTargetId: course.id,
      sectionId: input.sectionId,
      teacherId: input.teacherId,
      targetType: "course",
      verifyExistence: false,
    });
    if (!target) return invalidTarget("course");
    return {
      ok: true,
      target: {
        ...target,
        targetMetadata: {
          course: { jwId: course.jwId, nameCn: course.nameCn },
        },
      },
      targetType: "course",
    };
  }

  if (input.targetType === "course" && parseInteger(input.rawTargetId)) {
    const targetId = parseInteger(input.rawTargetId);
    countCommentStageQuery(counter);
    const course = await prisma.course.findUnique({
      where: { id: targetId as number },
      select: { id: true, jwId: true, nameCn: true },
    });
    if (!course) return targetNotFound("course", input.rawTargetId);
    const target = await resolveCommentTarget({
      rawTargetId: course.id,
      sectionId: input.sectionId,
      teacherId: input.teacherId,
      targetType: "course",
      verifyExistence: false,
    });
    if (!target) return invalidTarget("course");
    return {
      ok: true,
      target: {
        ...target,
        targetMetadata: {
          course: { jwId: course.jwId, nameCn: course.nameCn },
        },
      },
      targetType: "course",
    };
  }

  if (input.targetType === "teacher") {
    const targetId = parseInteger(input.teacherId ?? input.rawTargetId);
    if (!targetId) return invalidTarget("teacher");
    countCommentStageQuery(counter);
    const teacher = await prisma.teacher.findUnique({
      where: { id: targetId },
      select: { id: true, nameCn: true },
    });
    if (!teacher) {
      return targetNotFound("teacher", input.teacherId ?? input.rawTargetId);
    }
    const target = await resolveCommentTarget({
      rawTargetId: targetId,
      sectionId: input.sectionId,
      teacherId: input.teacherId,
      targetType: "teacher",
      verifyExistence: false,
    });
    if (!target) return invalidTarget("teacher");
    return {
      ok: true,
      target: {
        ...target,
        targetMetadata: { teacher: { nameCn: teacher.nameCn } },
      },
      targetType: "teacher",
    };
  }

  if (input.targetType === "homework") {
    const homeworkId = input.homeworkId ?? input.rawTargetId;
    if (typeof homeworkId !== "string" || homeworkId.trim().length === 0) {
      return invalidTarget("homework");
    }
    countCommentStageQuery(counter);
    const homework = await prisma.homework.findUnique({
      where: { id: homeworkId.trim() },
      select: {
        id: true,
        title: true,
        section: { select: { code: true, jwId: true } },
      },
    });
    if (!homework) return targetNotFound("homework", homeworkId);
    const target = await resolveCommentTarget({
      rawTargetId: homework.id,
      sectionId: input.sectionId,
      teacherId: input.teacherId,
      targetType: "homework",
      verifyExistence: false,
    });
    if (!target) return invalidTarget("homework");
    return {
      ok: true,
      target: {
        ...target,
        targetMetadata: {
          homework: {
            section: homework.section,
            title: homework.title,
          },
        },
      },
      targetType: "homework",
    };
  }

  if (input.targetType === "section-teacher") {
    const directReference = input.sectionTeacherId ?? input.rawTargetId;
    const directId = parseInteger(directReference);
    if (directReference) {
      if (!directId) return invalidTarget("section-teacher");
      countCommentStageQuery(counter);
      const sectionTeacher = await prisma.sectionTeacher.findFirst({
        where: { id: directId, retiredAt: null },
        select: {
          id: true,
          sectionId: true,
          teacherId: true,
          section: {
            select: {
              code: true,
              course: { select: { jwId: true, nameCn: true } },
              id: true,
              jwId: true,
            },
          },
          teacher: { select: { nameCn: true } },
        },
      });
      if (!sectionTeacher) {
        return targetNotFound(
          "section-teacher",
          input.sectionTeacherId ?? input.rawTargetId,
        );
      }
      const target = await resolveCommentTarget({
        allowDirectSectionTeacherId: true,
        rawTargetId: directId,
        sectionId: input.sectionId,
        teacherId: input.teacherId,
        targetType: "section-teacher",
        verifyExistence: false,
      });
      if (!target) return invalidTarget("section-teacher");
      return {
        ok: true,
        target: {
          ...target,
          targetMetadata: sectionTeacherMetadata({
            section: sectionTeacher.section,
            sectionId: sectionTeacher.sectionId,
            teacher: sectionTeacher.teacher,
            teacherId: sectionTeacher.teacherId,
          }),
        },
        targetType: "section-teacher",
      };
    }

    if (sectionJwId && parseInteger(input.teacherId)) {
      const teacherId = parseInteger(input.teacherId) as number;
      countCommentStageQuery(counter);
      const section = await prisma.section.findUnique({
        where: { jwId: sectionJwId },
        select: {
          code: true,
          course: { select: { jwId: true, nameCn: true } },
          id: true,
          jwId: true,
          sectionTeachers: {
            where: { retiredAt: null, teacherId },
            select: { id: true },
          },
          teachers: {
            where: { id: teacherId },
            select: { id: true, nameCn: true },
          },
        },
      });
      return resolveSectionTeacherListTarget(section, sectionJwId, teacherId);
    }

    const sectionId = parseInteger(input.sectionId);
    if (sectionId && parseInteger(input.teacherId)) {
      const teacherId = parseInteger(input.teacherId) as number;
      countCommentStageQuery(counter);
      const section = await prisma.section.findUnique({
        where: { id: sectionId },
        select: {
          code: true,
          course: { select: { jwId: true, nameCn: true } },
          id: true,
          jwId: true,
          sectionTeachers: {
            where: { retiredAt: null, teacherId },
            select: { id: true },
          },
          teachers: {
            where: { id: teacherId },
            select: { id: true, nameCn: true },
          },
        },
      });
      return resolveSectionTeacherListTarget(section, sectionId, teacherId);
    }

    return invalidTarget("section-teacher");
  }

  return null;
}
