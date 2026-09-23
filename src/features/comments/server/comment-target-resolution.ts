import { prisma } from "@/lib/db/prisma";
import { parseInteger } from "@/lib/integers";
import {
  createCommentStageCounter,
  markCommentStageCountsUnknown,
  observeCommentStage,
} from "./comment-stage-analytics";
import { resolveCommentListTargetReference } from "./comment-target-list-resolution";
import type {
  CommentTargetReferenceInput,
  ResolvedCommentMutationTarget,
  ResolvedCommentTargetReference,
} from "./comment-target-types";
import {
  invalidTarget,
  resolveCommentTargetReferenceWithoutListMetadata,
  targetNotFound,
} from "./comment-target-verify-resolution";

export type {
  CommentTargetReferenceInput,
  ResolvedCommentMutationTarget,
  ResolvedCommentTargetReference,
} from "./comment-target-types";

export async function resolveCommentTargetReference(
  input: CommentTargetReferenceInput,
): Promise<ResolvedCommentTargetReference> {
  const sectionJwId = parseInteger(input.sectionJwId);
  const courseJwId = parseInteger(input.courseJwId);

  if (input.includeTargetMetadata) {
    const counter = createCommentStageCounter({
      dbContext: "none",
      dbLabel: "app",
    });
    return observeCommentStage({
      counter,
      stage: "target.resolve",
      work: async () => {
        const resolved = await resolveCommentListTargetReference(
          input,
          sectionJwId,
          courseJwId,
          counter,
        );
        if (resolved) return resolved;

        // The legacy verification path has database work outside the local
        // operation counter. Do not publish a partial count for it.
        markCommentStageCountsUnknown(counter);
        return resolveCommentTargetReferenceWithoutListMetadata(
          input,
          sectionJwId,
          courseJwId,
        );
      },
    });
  }

  return resolveCommentTargetReferenceWithoutListMetadata(
    input,
    sectionJwId,
    courseJwId,
  );
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
