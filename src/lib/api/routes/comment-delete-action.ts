import { deleteOwnComment } from "@/features/comments/server/comment-mutations";
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

export async function deleteOwnCommentAction(input: {
  commentId: string;
  request: Request;
  userId: string;
}) {
  const result = await deleteOwnComment(input);
  if (!result.ok) {
    if (result.error === "suspended") {
      return suspensionForbidden("reason" in result ? result.reason : null);
    }
    return result.error === "not_found" ? notFound() : forbidden();
  }

  fireAuditLog({
    action: "comment_delete",
    userId: input.userId,
    targetId: input.commentId,
    targetType: "comment",
    ...getAuditRequestMetadata(input.request),
  });

  return jsonResponse({ success: true });
}
