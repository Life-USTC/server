import { deleteCommentReaction } from "@/features/comments/server/comment-mutations";
import {
  forbidden,
  handleRouteError,
  jsonResponse,
  parseRouteInput,
  parseRouteSearchParams,
  suspensionForbidden,
} from "@/lib/api/helpers";
import {
  commentReactionRequestSchema,
  resourceIdPathParamsSchema,
} from "@/lib/api/schemas/request-schemas";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import { requireAuth } from "@/lib/auth/api-auth";

type IdParams = { id: string };

export async function deleteCommentReactionRoute(
  request: Request,
  params: IdParams,
) {
  const auth = await requireAuth(request, {
    bearerScope: { feature: "community.comment", action: "write" },
  });
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const parsedParams = parseRouteInput(
    params,
    resourceIdPathParamsSchema,
    "Invalid comment ID",
  );
  if (parsedParams instanceof Response) {
    return parsedParams;
  }
  const id = parsedParams.id;
  const { searchParams } = new URL(request.url);
  const parsedBody = parseRouteSearchParams(
    searchParams,
    commentReactionRequestSchema,
    "Invalid reaction",
    { logErrors: true },
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }
  const type = parsedBody.type;

  try {
    const result = await deleteCommentReaction({
      auditMetadata: getAuditRequestMetadata(request),
      commentId: id,
      type,
      userId,
    });
    if (!result.ok) {
      if (result.error === "suspended") {
        return suspensionForbidden("reason" in result ? result.reason : null);
      }
      return forbidden();
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return handleRouteError("Failed to remove reaction", error);
  }
}
