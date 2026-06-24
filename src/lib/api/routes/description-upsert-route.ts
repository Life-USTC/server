import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import {
  badRequest,
  forbidden,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
  suspensionForbidden,
} from "@/lib/api/helpers";
import { descriptionUpsertRequestSchema } from "@/lib/api/schemas/request-schemas";
import { getAuditRequestMetadata } from "@/lib/audit/write-audit-log";
import { requireAuth } from "@/lib/auth/api-auth";

export async function postDescriptionRoute(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

  const parsedBody = await parseRouteJsonBody(
    request,
    descriptionUpsertRequestSchema,
    "Invalid description request",
  );
  if (parsedBody instanceof Response) {
    return parsedBody;
  }

  const targetType = parsedBody.targetType;
  const content = parsedBody.content.trim();

  try {
    const result = await upsertDescriptionContent({
      auditMetadata: getAuditRequestMetadata(request),
      content,
      targetId: parsedBody.targetId,
      targetType,
      userId,
    });
    if (!result.ok) {
      if (result.error === "invalid_target")
        return badRequest("Invalid target");
      if (result.error === "not_found") return notFound("Target not found");
      if (result.error === "suspended")
        return suspensionForbidden("reason" in result ? result.reason : null);
      return forbidden();
    }

    return jsonResponse({ id: result.id, updated: result.updated });
  } catch (error) {
    return handleRouteError("Failed to update description", error);
  }
}
