import { forbidden, jsonResponse, notFound } from "@/lib/api/helpers";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";

export async function deleteOwnCommentAction(input: {
  commentId: string;
  request: Request;
  userId: string;
}) {
  const { prisma } = await import("@/lib/db/prisma");
  const comment = await prisma.comment.findUnique({
    where: { id: input.commentId },
    select: { id: true, userId: true },
  });

  if (!comment) {
    return notFound();
  }

  if (comment.userId !== input.userId) {
    return forbidden();
  }

  await prisma.comment.update({
    where: { id: input.commentId },
    data: {
      status: "deleted",
      deletedAt: new Date(),
    },
  });

  fireAuditLog({
    action: "comment_delete",
    userId: input.userId,
    targetId: input.commentId,
    targetType: "comment",
    ...getAuditRequestMetadata(input.request),
  });

  return jsonResponse({ success: true });
}
