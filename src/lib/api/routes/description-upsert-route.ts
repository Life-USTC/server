import {
  type DescriptionTargetType,
  resolveDescriptionTarget,
} from "@/features/descriptions/server/description-targets";
import { upsertDescriptionContent } from "@/features/descriptions/server/description-upsert";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
} from "@/lib/api/helpers";
import { descriptionUpsertRequestSchema } from "@/lib/api/schemas/request-schemas";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { requireWriteAuth } from "@/lib/auth/api-auth";

export async function postDescriptionRoute(request: Request) {
  const auth = await requireWriteAuth(request);
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

  const target = resolveDescriptionTarget(
    targetType as DescriptionTargetType,
    parsedBody.targetId,
  );
  if (!target) {
    return badRequest("Invalid target");
  }

  try {
    const existingTarget = await target.ensureExists();
    if (!existingTarget) {
      return notFound("Target not found");
    }

    const result = await upsertDescriptionContent({
      content,
      target,
      userId,
    });

    if (result.updated) {
      fireAuditLog({
        action: "description_edit",
        userId,
        targetId: result.id,
        targetType: "description",
        metadata: { targetType, content: content.slice(0, 200) },
        ...getAuditRequestMetadata(request),
      });
    }

    return jsonResponse({ id: result.id, updated: result.updated });
  } catch (error) {
    return handleRouteError("Failed to update description", error);
  }
}
