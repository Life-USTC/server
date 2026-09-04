import type { CommentReactionType } from "@/generated/prisma/client";
import { withUserDbContext } from "@/lib/db/prisma";
import { withCommentDbContext } from "./comment-db-context";
import { canViewerWriteCommentInteraction } from "./comment-interaction-policy";
import {
  type CommentMutationAuditMetadata,
  loadActiveCommentActor,
  writeCommentAuditLog,
} from "./comment-mutation-helpers";

export async function createCommentReaction(input: {
  auditMetadata?: CommentMutationAuditMetadata;
  commentId: string;
  type: string;
  userId: string;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const comment = await withCommentDbContext(input.userId, (client) =>
    client.comment.findUnique({
      where: { id: input.commentId },
      select: { id: true, status: true, visibility: true },
    }),
  );

  if (!comment) {
    return { ok: false as const, error: "not_found" as const };
  }
  if (!canViewerWriteCommentInteraction(comment, actor.viewer)) {
    return { ok: false as const, error: "locked" as const };
  }

  const changed = await withUserDbContext(input.userId, async (tx) => {
    const result = await tx.commentReaction.createMany({
      data: [
        {
          commentId: input.commentId,
          userId: input.userId,
          type: input.type as CommentReactionType,
        },
      ],
      skipDuplicates: true,
    });
    if (result.count === 0) return false;

    await writeCommentAuditLog(tx, {
      action: "comment_react",
      commentId: input.commentId,
      metadata: input.auditMetadata,
      operation: "add",
      reactionType: input.type,
      userId: input.userId,
    });

    return true;
  });

  return { ok: true as const, changed };
}

export async function deleteCommentReaction(input: {
  auditMetadata?: CommentMutationAuditMetadata;
  commentId: string;
  type: CommentReactionType;
  userId: string;
}) {
  const actor = await loadActiveCommentActor(input.userId);
  if (!actor.ok) return actor;

  const comment = await withCommentDbContext(input.userId, (client) =>
    client.comment.findUnique({
      where: { id: input.commentId },
      select: { id: true, status: true, visibility: true },
    }),
  );

  if (!comment) {
    return { ok: true as const, changed: false };
  }

  if (!canViewerWriteCommentInteraction(comment, actor.viewer)) {
    return { ok: false as const, error: "locked" as const };
  }

  const changed = await withUserDbContext(input.userId, async (tx) => {
    const result = await tx.commentReaction.deleteMany({
      where: {
        commentId: input.commentId,
        userId: input.userId,
        type: input.type,
      },
    });
    if (result.count === 0) return false;

    await writeCommentAuditLog(tx, {
      action: "comment_react",
      commentId: input.commentId,
      metadata: input.auditMetadata,
      operation: "remove",
      reactionType: input.type,
      userId: input.userId,
    });

    return true;
  });

  return { ok: true as const, changed };
}
