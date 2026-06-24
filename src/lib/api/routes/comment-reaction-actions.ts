import { createCommentReaction } from "@/features/comments/server/comment-mutations";
import {
  forbidden,
  jsonResponse,
  notFound,
  suspensionForbidden,
} from "@/lib/api/helpers";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";

export async function createCommentReactionAction(input: {
  commentId: string;
  request: Request;
  type: string;
  userId: string;
}) {
  const result = await createCommentReaction(input);
  if (!result.ok) {
    if (result.error === "suspended") {
      return suspensionForbidden("reason" in result ? result.reason : null);
    }
    return result.error === "not_found" ? notFound() : forbidden();
  }

  if (result.changed) {
    writeCommentReactionAuditLog({
      commentId: input.commentId,
      operation: "add",
      request: input.request,
      type: input.type,
      userId: input.userId,
    });
  }

  return jsonResponse({ success: true });
}

export function writeCommentReactionAuditLog({
  commentId,
  operation,
  request,
  type,
  userId,
}: {
  commentId: string;
  operation: "add" | "remove";
  request: Request;
  type: string;
  userId: string;
}) {
  fireAuditLog({
    action: "comment_react",
    userId,
    targetId: commentId,
    targetType: "comment",
    metadata: { operation, type },
    ...getAuditRequestMetadata(request),
  });
}
