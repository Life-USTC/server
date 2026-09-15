import type { CommentVisibility } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import { isPrismaUniqueConstraintError } from "@/lib/db/prisma-errors";
import {
  syncCommentAttachments,
  validateCommentAttachmentIds,
} from "./comment-attachments";
import { withCommentDbContext } from "./comment-db-context";
import { canViewerWriteCommentInteraction } from "./comment-interaction-policy";
import {
  type CommentMutationAuditMetadata,
  loadActiveCommentActor,
  loadCommentResponse,
  loadEditableCommentContext,
  loadOwnActiveCommentFailure,
  writeCommentAuditLog,
} from "./comment-mutation-helpers";

export async function updateOwnComment({
  attachmentIds,
  auditMetadata,
  body,
  hasAttachmentUpdate,
  id,
  isAnonymous,
  userId,
  visibility,
}: {
  attachmentIds: string[];
  auditMetadata?: CommentMutationAuditMetadata;
  body?: string;
  hasAttachmentUpdate: boolean;
  id: string;
  isAnonymous?: boolean;
  userId: string;
  visibility?: CommentVisibility;
}) {
  const context = await loadEditableCommentContext({ id, userId });
  if (!context.ok) return context;

  if (hasAttachmentUpdate) {
    const attachmentsValid = await validateCommentAttachmentIds(
      userId,
      attachmentIds,
      { commentId: id },
    );
    if (!attachmentsValid) {
      return { ok: false as const, error: "invalid_attachments" as const };
    }
  }

  let updated = false;
  try {
    await withUserDbContext(userId, async (tx) => {
      const result = await tx.comment.updateMany({
        where: { id, status: "active", userId },
        data: {
          body,
          visibility,
          isAnonymous,
        },
      });
      if (result.count !== 1) return;
      updated = true;

      if (hasAttachmentUpdate) {
        await syncCommentAttachments(tx, id, attachmentIds);
      }

      await writeCommentAuditLog(tx, {
        action: "comment_edit",
        commentId: id,
        metadata: auditMetadata,
        userId,
      });
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) throw error;
    return { ok: false as const, error: "invalid_attachments" as const };
  }
  if (!updated) {
    return loadOwnActiveCommentFailure({ id, userId, viewer: context.viewer });
  }

  const comment = await loadCommentResponse(id, context.viewer);
  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }

  return { ok: true as const, comment };
}

export async function deleteOwnComment(input: {
  auditMetadata?: CommentMutationAuditMetadata;
  commentId: string;
  userId: string;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const comment = await withCommentDbContext(input.userId, (client) =>
    client.comment.findUnique({
      where: { id: input.commentId },
      select: { id: true, status: true, userId: true, visibility: true },
    }),
  );

  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }

  if (comment.userId !== input.userId) {
    return { ok: false as const, error: "forbidden" as const };
  }

  if (!canViewerWriteCommentInteraction(comment, actor.viewer)) {
    return { ok: false as const, error: "locked" as const };
  }

  const deleted = await withUserDbContext(input.userId, async (tx) => {
    const result = await tx.comment.updateMany({
      where: { id: input.commentId, status: "active", userId: input.userId },
      data: {
        status: "deleted",
        deletedAt: new Date(),
      },
    });
    if (result.count !== 1) return false;

    await writeCommentAuditLog(tx, {
      action: "comment_delete",
      commentId: input.commentId,
      metadata: input.auditMetadata,
      userId: input.userId,
    });

    return true;
  });
  if (!deleted) {
    return loadOwnActiveCommentFailure({
      id: input.commentId,
      userId: input.userId,
      viewer: actor.viewer,
    });
  }

  return { ok: true as const };
}
