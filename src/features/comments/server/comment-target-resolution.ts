import { resolveCourseIdByJwId } from "@/features/catalog/server/course-jw-id";
import { prisma } from "@/lib/db/prisma";
import { parseInteger } from "@/lib/integers";
import {
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
