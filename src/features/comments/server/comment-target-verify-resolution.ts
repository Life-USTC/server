import { resolveCourseIdByJwId } from "@/features/catalog/server/course-jw-id";
import { prisma } from "@/lib/db/prisma";
import type {
  CommentTargetReferenceInput,
  ResolvedCommentTargetReference,
  UnresolvedCommentTargetReference,
} from "./comment-target-types";
import { type CommentTargetType, resolveCommentTarget } from "./comment-utils";

export function invalidTarget(
  targetType: CommentTargetType,
): UnresolvedCommentTargetReference {
  return {
    ok: false,
    error: "invalid_target",
    targetId: undefined,
    targetType,
  };
}

export function targetNotFound(
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

export async function resolveCommentTargetReferenceWithoutListMetadata(
  input: CommentTargetReferenceInput,
  sectionJwId: number | null,
  courseJwId: number | null,
): Promise<ResolvedCommentTargetReference> {
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
