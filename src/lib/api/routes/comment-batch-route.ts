import { deleteOwnComment } from "@/features/comments/server/comment-mutations";
import {
  handleRouteError,
  jsonResponse,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { commentBatchDeleteRequestSchema } from "@/lib/api/schemas/request-schemas";
import { commentBatchDeleteResponseSchema } from "@/lib/api/schemas/response-schemas";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import { requireAuth } from "@/lib/auth/api-auth";

function batchDeleteErrorMessage(
  code: "not_found" | "forbidden" | "locked",
): string {
  switch (code) {
    case "not_found":
      return "Comment not found";
    case "locked":
      return "Comment locked";
    default:
      return "Forbidden";
  }
}

export async function deleteCommentBatchRoute(request: Request) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "comment", action: "write" },
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
    const auditMetadata = getAuditRequestMetadata(request);
    const results = await Promise.all(
      body.ids.map(async (id) => {
        const result = await deleteOwnComment({
          auditMetadata,
          commentId: id,
          userId: auth.userId,
        });
        if (!result.ok) {
          const code =
            result.error === "suspended" ? "forbidden" : result.error;
          return {
            success: false as const,
            id,
            error: { code, message: batchDeleteErrorMessage(code) },
          };
        }
        return { success: true as const, id };
      }),
    );

    return jsonResponse(commentBatchDeleteResponseSchema.parse({ results }));
  } catch (error) {
    return handleRouteError("Failed to delete comment batch", error);
  }
}
