import type { CommentReactionType } from "@/generated/prisma/client";
import { jsonResponse, notFound } from "@/lib/api/helpers";

export async function createCommentReactionAction(input: {
  commentId: string;
  type: string;
  userId: string;
}) {
  const { prisma } = await import("@/lib/db/prisma");
  const comment = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: { id: true },
  });

  if (!comment) {
    return notFound();
  }

  await prisma.commentReaction.upsert({
    where: {
      commentId_userId_type: {
        commentId: input.commentId,
        userId: input.userId,
        type: input.type as CommentReactionType,
      },
    },
    update: {},
    create: {
      commentId: input.commentId,
      userId: input.userId,
      type: input.type as CommentReactionType,
    },
  });

  return jsonResponse({ success: true });
}
