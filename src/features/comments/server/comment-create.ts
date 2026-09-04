import type { CommentVisibility, Prisma } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import { isPrismaUniqueConstraintError } from "@/lib/db/prisma-errors";
import { validateCommentAttachmentIds } from "./comment-attachments";
import { canViewerWriteCommentInteraction } from "./comment-interaction-policy";
import {
  type CommentMutationAuditMetadata,
  type CreateCommentError,
  type CreateCommentTarget,
  loadActiveCommentActor,
  writeCommentAuditLog,
} from "./comment-mutation-helpers";
import type { ViewerInfo } from "./comment-serialization";
import { resolveCommentMutationTargetReference } from "./comment-target-resolution";
import { type CommentTargetType, resolveCommentTarget } from "./comment-utils";

export async function createComment(input: {
  attachmentIds?: string[];
  auditMetadata?: CommentMutationAuditMetadata;
  content: string;
  courseJwId?: unknown;
  homeworkId?: string;
  isAnonymous: boolean;
  parentId?: string | null;
  rawTargetId: unknown;
  sectionId?: unknown;
  sectionJwId?: unknown;
  sectionTeacherId?: unknown;
  targetType: CommentTargetType;
  teacherId?: unknown;
  userId: string;
  visibility: CommentVisibility;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const reference = await resolveCommentMutationTargetReference({
    courseJwId: input.courseJwId,
    homeworkId: input.homeworkId,
    rawTargetId: input.rawTargetId,
    sectionId: input.sectionId,
    sectionJwId: input.sectionJwId,
    sectionTeacherId: input.sectionTeacherId,
    targetType: input.targetType,
    teacherId: input.teacherId,
  });
  if (!reference.ok) {
    return {
      ok: false as const,
      error: reference.error as Extract<
        CreateCommentError,
        "invalid_target" | "target_not_found"
      >,
      targetId: reference.targetId,
      targetType: reference.targetType,
    };
  }

  const target = await resolveCommentTarget({
    createSectionTeacherTarget: true,
    rawTargetId: reference.rawTargetId,
    sectionId: reference.sectionId,
    targetType: input.targetType,
    teacherId: reference.teacherId,
    verifyExistence: true,
  });
  if (!target) {
    return {
      ok: false as const,
      error: "invalid_target" as CreateCommentError,
      targetId: input.rawTargetId,
      targetType: input.targetType,
    };
  }
  if (!target.verified) {
    return {
      ok: false as const,
      error: "target_not_found" as CreateCommentError,
      targetId: reference.rawTargetId,
      targetType: input.targetType,
    };
  }

  const attachmentIds = input.attachmentIds ?? [];
  if (
    attachmentIds.length > 0 &&
    !(await validateCommentAttachmentIds(input.userId, attachmentIds))
  ) {
    return {
      ok: false as const,
      error: "invalid_attachments" as CreateCommentError,
    };
  }

  let result: Awaited<ReturnType<typeof createCommentRecord>>;
  try {
    result = await createCommentRecord({
      attachmentIds,
      content: input.content,
      isAnonymous: input.isAnonymous,
      auditMetadata: input.auditMetadata,
      parentId: input.parentId,
      target,
      userId: input.userId,
      viewer: actor.viewer,
      visibility: input.visibility,
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
    return {
      ok: false as const,
      error: "invalid_attachments" as CreateCommentError,
    };
  }
  if (!result.ok) return result;

  return { ok: true as const, comment: result.comment };
}

async function createCommentRecord({
  attachmentIds,
  auditMetadata,
  content,
  isAnonymous,
  parentId,
  target,
  userId,
  viewer,
  visibility,
}: {
  attachmentIds: string[];
  auditMetadata?: CommentMutationAuditMetadata;
  content: string;
  isAnonymous: boolean;
  parentId?: string | null;
  target: CreateCommentTarget;
  userId: string;
  viewer: ViewerInfo;
  visibility: CommentVisibility;
}) {
  return withUserDbContext(userId, async (tx) => {
    const parent = await resolveCreateCommentParentForWrite({
      parentId,
      tx,
      viewer,
      whereTarget: target.whereTarget,
    });
    if (!parent.ok) return parent;

    const comment = await tx.comment.create({
      data: {
        body: content,
        visibility,
        status: "active",
        isAnonymous,
        authorName: null,
        userId,
        parentId: parent.parentId,
        rootId: parent.rootId,
        ...target.whereTarget,
      },
    });

    if (!parent.rootId) {
      await tx.comment.update({
        where: { id: comment.id },
        data: { rootId: comment.id },
      });
    }

    if (attachmentIds.length > 0) {
      await tx.commentAttachment.createMany({
        data: attachmentIds.map((uploadId) => ({
          uploadId,
          commentId: comment.id,
        })),
      });
    }

    await writeCommentAuditLog(tx, {
      action: "comment_create",
      commentId: comment.id,
      metadata: auditMetadata,
      userId,
    });

    return { ok: true as const, comment };
  });
}

async function resolveCreateCommentParentForWrite({
  parentId,
  tx,
  viewer,
  whereTarget,
}: {
  parentId: string | null | undefined;
  tx: Prisma.TransactionClient;
  viewer: ViewerInfo;
  whereTarget: Record<string, unknown>;
}) {
  if (!parentId) {
    return { ok: true as const, parentId: null, rootId: null };
  }

  const lockedParent = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Comment" WHERE "id" = ${parentId} FOR UPDATE
  `;
  if (lockedParent.length === 0) {
    return { ok: false as const, error: "parent_not_found" as const };
  }

  const parent = await tx.comment.findUnique({
    where: { id: parentId },
  });
  if (!parent) {
    return { ok: false as const, error: "parent_not_found" as const };
  }
  if (!canViewerWriteCommentInteraction(parent, viewer)) {
    return { ok: false as const, error: "locked" as const };
  }

  const sameTarget = Object.entries(whereTarget).every(
    ([key, value]) => parent[key as keyof typeof parent] === value,
  );
  if (!sameTarget) {
    return { ok: false as const, error: "target_mismatch" as const };
  }

  return {
    ok: true as const,
    parentId: parent.id,
    rootId: parent.rootId ?? parent.id,
  };
}
