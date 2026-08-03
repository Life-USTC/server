import { moderateComment } from "@/features/admin/server/admin-api-service";
import { jsonResponse, notFound, parseRouteJsonBody } from "@/lib/api/helpers";
import { withAdminApiRoute } from "@/lib/api/routes/admin-route-auth";
import { adminModerateCommentRequestSchema } from "@/lib/api/schemas/request-schemas";
import { type IdParams, parseIdParam } from "./admin-shared";

export async function patchAdminCommentRoute(
  request: Request,
  params: IdParams,
) {
  return withAdminApiRoute(
    request,
    "Failed to update comment",
    async (admin) => {
      const parsed = parseIdParam(params, "comment");
      if (parsed instanceof Response) return parsed;
      const id = parsed.id;
      const parsedBody = await parseRouteJsonBody(
        request,
        adminModerateCommentRequestSchema,
        "Invalid moderation request",
      );
      if (parsedBody instanceof Response) return parsedBody;

      const result = await moderateComment(admin.userId, id, {
        moderationNote: parsedBody.moderationNote,
        status: parsedBody.status,
      });
      if (!result.ok) return notFound();

      return jsonResponse({ comment: result.comment });
    },
  );
}
