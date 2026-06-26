import { deleteOwnComment } from "@/features/comments/server/comment-mutations";
import {
  forbidden,
  jsonResponse,
  notFound,
  suspensionForbidden,
} from "@/lib/api/helpers";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";

export async function deleteOwnCommentAction(input: {
  commentId: string;
  request: Request;
  userId: string;
}) {
  const result = await deleteOwnComment({
    auditMetadata: getAuditRequestMetadata(input.request),
    commentId: input.commentId,
    userId: input.userId,
  });
  if (!result.ok) {
    if (result.error === "suspended") {
      return suspensionForbidden("reason" in result ? result.reason : null);
    }
    if (result.error === "locked") return forbidden("Comment locked");
    return result.error === "not_found" ? notFound() : forbidden();
  }

  return jsonResponse({ success: true });
}
