import { resolveDescriptionTargetReference } from "@/features/descriptions/server/description-targets";
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
  const auth = await requireAuth(request, {
    bearerScope: { feature: "description", action: "write" },
  });
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
    const target = await resolveDescriptionTargetReference({
      courseJwId: parsedBody.courseJwId,
      homeworkId: parsedBody.homeworkId,
      rawTargetId: parsedBody.targetId,
      sectionJwId: parsedBody.sectionJwId,
      targetType,
      teacherId: parsedBody.teacherId,
      verifyExistence: true,
    });
    if (!target.ok && target.error === "target_not_found") {
      return notFound("Target not found");
    }
    if (!target.ok) {
      return badRequest("Invalid target");
    }

    const result = await upsertDescriptionContent({
      auditMetadata: getAuditRequestMetadata(request),
      content,
      targetId: target.targetId,
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
