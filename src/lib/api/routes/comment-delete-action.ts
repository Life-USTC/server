import { deleteOwnComment } from "@/features/comments/server/comment-mutations";
import {
  forbidden,
  jsonResponse,
  notFound,
  suspensionForbidden,
} from "@/lib/api/helpers";
import { attributionFromApiPrincipal } from "@/lib/audit/principal-attribution";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import type { ApiPrincipal } from "@/lib/auth/api-auth";

export async function deleteOwnCommentAction(input: {
  commentId: string;
  principal: ApiPrincipal;
  request: Request;
}) {
  const result = await deleteOwnComment({
    auditMetadata: {
      ...getAuditRequestMetadata(input.request),
      ...attributionFromApiPrincipal(input.principal),
    },
    commentId: input.commentId,
    userId: input.principal.userId,
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
