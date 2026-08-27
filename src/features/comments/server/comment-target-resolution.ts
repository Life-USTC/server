import { resolveCourseIdByJwId } from "@/features/catalog/server/course-jw-id";
import { prisma } from "@/lib/db/prisma";
import { parseInteger } from "@/lib/integers";
import {
  type CommentTargetMetadataSource,
  type CommentTargetType,
  type ResolvedCommentTarget,
  resolveCommentTarget,
} from "./comment-utils";

export type CommentTargetReferenceInput = {
  allowDirectSectionTeacherId?: boolean;
  courseJwId?: unknown;
  homeworkId?: string;
  rawTargetId?: unknown;
  sectionId?: unknown;
  sectionJwId?: unknown;
  sectionTeacherId?: unknown;
  targetType: CommentTargetType;
  teacherId?: unknown;
  verifyExistence?: boolean;
  /** Select the public target payload while verifying the target. */
  includeTargetMetadata?: boolean;
};

export type ResolvedCommentTargetReference =
  | {
      ok: true;
      target: ResolvedCommentTarget;
      targetType: CommentTargetType;
    }
  | {
      ok: false;
      error: "invalid_target" | "target_not_found";
      targetId: unknown;
      targetType: CommentTargetType | string;
    };

type UnresolvedCommentTargetReference = Extract<
  ResolvedCommentTargetReference,
  { ok: false }
>;

export type ResolvedCommentMutationTarget =
  | {
      ok: true;
      rawTargetId: unknown;
      sectionId?: unknown;
      teacherId?: unknown;
    }
  | Extract<ResolvedCommentTargetReference, { ok: false }>;

async function findSectionIdByJwId(jwId: number) {
  const section = await prisma.section.findUnique({
    where: { jwId },
    select: { id: true },
  });
  return section?.id ?? null;
}

async function findCourseIdByJwId(jwId: number) {
  return resolveCourseIdByJwId(prisma, jwId);
}

function invalidTarget(
  targetType: CommentTargetType,
): UnresolvedCommentTargetReference {
  return {
    ok: false,
    error: "invalid_target",
    targetId: undefined,
    targetType,
  };
}

function targetNotFound(
  targetType: CommentTargetType | string,
  targetId: unknown,
): UnresolvedCommentTargetReference {
  return {
    ok: false,
    error: "target_not_found",
    targetId,
    targetType,
  };
}

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

async function resolveCommentListTargetReference(
  input: CommentTargetReferenceInput,
  sectionJwId: number | null,
  courseJwId: number | null,
): Promise<ResolvedCommentTargetReference | null> {
  if (input.targetType === "section" && sectionJwId) {
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
      const teacher = section?.teachers[0];
      if (!section) return targetNotFound("section", sectionJwId);
      if (!teacher) return targetNotFound("section-teacher", sectionJwId);
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

    return invalidTarget("section-teacher");
  }

  return null;
}

async function resolveVerifiedTarget(
  targetType: CommentTargetType,
  rawTargetId: unknown,
  input: Pick<
    CommentTargetReferenceInput,
    | "allowDirectSectionTeacherId"
    | "sectionId"
    | "teacherId"
    | "verifyExistence"
  >,
): Promise<ResolvedCommentTargetReference> {
  const target = await resolveCommentTarget({
    allowDirectSectionTeacherId: input.allowDirectSectionTeacherId,
    rawTargetId,
    sectionId: input.sectionId,
    targetType,
    teacherId: input.teacherId,
    verifyExistence: input.verifyExistence,
  });

  if (!target) return invalidTarget(targetType);
  if (!target.verified) return targetNotFound(targetType, rawTargetId);

  return { ok: true, target, targetType };
}

export async function resolveCommentTargetReference(
  input: CommentTargetReferenceInput,
): Promise<ResolvedCommentTargetReference> {
  const sectionJwId = parseInteger(input.sectionJwId);
  const courseJwId = parseInteger(input.courseJwId);

  if (input.includeTargetMetadata) {
    const resolved = await resolveCommentListTargetReference(
      input,
      sectionJwId,
      courseJwId,
    );
    if (resolved) return resolved;
  }

  if (input.targetType === "section" && sectionJwId) {
    const sectionId = await findSectionIdByJwId(sectionJwId);
    if (!sectionId) return targetNotFound("section", sectionJwId);
    return resolveVerifiedTarget("section", sectionId, input);
  }

  if (input.targetType === "course" && courseJwId) {
    const courseId = await findCourseIdByJwId(courseJwId);
    if (!courseId) return targetNotFound("course", courseJwId);
    return resolveVerifiedTarget("course", courseId, input);
  }

  if (input.targetType === "teacher") {
    return resolveVerifiedTarget(
      "teacher",
      input.teacherId ?? input.rawTargetId,
      input,
    );
  }

  if (input.targetType === "homework") {
    return resolveVerifiedTarget(
      "homework",
      input.homeworkId ?? input.rawTargetId,
      input,
    );
  }

  if (input.targetType === "section-teacher") {
    const directId = input.sectionTeacherId ?? input.rawTargetId;
    if (directId) {
      return resolveVerifiedTarget("section-teacher", directId, input);
    }

    if (sectionJwId && input.teacherId) {
      const sectionId = await findSectionIdByJwId(sectionJwId);
      if (!sectionId) return targetNotFound("section", sectionJwId);

      const target = await resolveCommentTarget({
        rawTargetId: undefined,
        sectionId,
        targetType: "section-teacher",
        teacherId: input.teacherId,
        verifyExistence: input.verifyExistence,
      });
      if (!target?.verified) {
        return targetNotFound("section-teacher", sectionJwId);
      }
      return { ok: true, target, targetType: "section-teacher" };
    }
  }

  return resolveVerifiedTarget(input.targetType, input.rawTargetId, input);
}

export async function resolveCommentMutationTargetReference(
  input: CommentTargetReferenceInput,
): Promise<ResolvedCommentMutationTarget> {
  const resolved = await resolveCommentTargetReference({
    ...input,
    allowDirectSectionTeacherId: true,
    verifyExistence: true,
  });

  if (!resolved.ok) return resolved;
  if (input.targetType !== "section-teacher") {
    return { ok: true, rawTargetId: resolved.target.targetId };
  }

  if (resolved.target.sectionId && resolved.target.teacherId) {
    return {
      ok: true,
      rawTargetId: undefined,
      sectionId: resolved.target.sectionId,
      teacherId: resolved.target.teacherId,
    };
  }

  if (resolved.target.sectionTeacherId) {
    const sectionTeacher = await prisma.sectionTeacher.findFirst({
      where: { id: resolved.target.sectionTeacherId, retiredAt: null },
      select: { sectionId: true, teacherId: true },
    });
    if (sectionTeacher) {
      return {
        ok: true,
        rawTargetId: undefined,
        sectionId: sectionTeacher.sectionId,
        teacherId: sectionTeacher.teacherId,
      };
    }
    return targetNotFound("section-teacher", resolved.target.sectionTeacherId);
  }

  return invalidTarget("section-teacher");
}
