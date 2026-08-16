import { deleteOwnCommentsBatch } from "@/features/comments/server/comment-batch-delete";
import {
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { commentBatchDeleteRequestSchema } from "@/lib/api/schemas/request-schemas";
import { commentBatchDeleteResponseSchema } from "@/lib/api/schemas/response-schemas";
import { attributionFromApiPrincipal } from "@/lib/audit/principal-attribution";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import { requireAuthPrincipal } from "@/lib/auth/api-auth";

export async function deleteCommentBatchRoute(request: Request) {
  const auth = await requireAuthPrincipal(request, {
    bearerScope: { feature: "community.comment", action: "write" },
    rateLimit: { action: "comment:batch-write", tier: "batch" },
  });
  if (auth instanceof Response) return auth;

  const body = await parseRouteJsonBody(
    request,
    commentBatchDeleteRequestSchema,
    "Invalid batch payload",
  );
  if (body instanceof Response) return body;

  try {
    const auditMetadata = {
      ...getAuditRequestMetadata(request),
      ...attributionFromApiPrincipal(auth),
    };
    const result = await deleteOwnCommentsBatch({
      auditMetadata,
      ids: body.ids,
      userId: auth.userId,
    });

    return jsonResponse(commentBatchDeleteResponseSchema.parse(result));
  } catch (error) {
    return handleRouteError("Failed to delete comment batch", error);
  }
}
