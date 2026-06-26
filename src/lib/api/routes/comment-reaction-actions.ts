import { createCommentReaction } from "@/features/comments/server/comment-mutations";
import {
  forbidden,
  jsonResponse,
  notFound,
  suspensionForbidden,
} from "@/lib/api/helpers";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";

export async function createCommentReactionAction(input: {
  commentId: string;
  request: Request;
  type: string;
  userId: string;
}) {
  const result = await createCommentReaction({
    auditMetadata: getAuditRequestMetadata(input.request),
    commentId: input.commentId,
    type: input.type,
    userId: input.userId,
  });
  if (!result.ok) {
    if (result.error === "suspended") {
      return suspensionForbidden("reason" in result ? result.reason : null);
    }
    return result.error === "not_found" ? notFound() : forbidden();
  }

  return jsonResponse({ success: true });
}
