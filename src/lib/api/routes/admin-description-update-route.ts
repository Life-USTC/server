import { moderateDescription } from "@/features/admin/server/admin-api-service";
import {
  badRequest,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { withAdminApiRoute } from "@/lib/api/routes/admin-route-auth";
import { adminModerateDescriptionRequestSchema } from "@/lib/api/schemas/request-schemas";
import { type IdParams, parseIdParam } from "./admin-shared";

export async function patchAdminDescriptionRoute(
  request: Request,
  params: IdParams,
) {
  return withAdminApiRoute(
    request,
    "Failed to update description",
    async (admin) => {
      const parsed = parseIdParam(params, "description");
      if (parsed instanceof Response) return parsed;
      const id = parsed.id;
      const parsedBody = await parseRouteJsonBody(
        request,
        adminModerateDescriptionRequestSchema,
        "Invalid description moderation request",
      );
      if (parsedBody instanceof Response) return parsedBody;

      const result = await moderateDescription(admin.userId, id, {
        content: parsedBody.content,
      });
      if (!result.ok && result.reason === "invalid_content") {
        return badRequest("Invalid description moderation request");
      }
      if (!result.ok) return notFound();

      return jsonResponse({ description: result.description });
    },
    { requireActive: true },
  );
}
