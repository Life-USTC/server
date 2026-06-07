import {
  type DescriptionTargetType,
  resolveDescriptionTarget,
} from "@/features/descriptions/lib/description-targets";
import { getDescriptionPayload } from "@/features/descriptions/server/descriptions-server";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteJsonBody,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import {
  descriptionsQuerySchema,
  descriptionUpsertRequestSchema,
} from "@/lib/api/schemas/request-schemas";
import {
  fireAuditLog,
  getAuditRequestMetadata,
} from "@/lib/audit/write-audit-log";
import { requireWriteAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Get description and history by target.
 * @params descriptionsQuerySchema
 * @response descriptionsResponseSchema
 * @response 400:openApiErrorSchema
 */
async function getRoute(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsedQuery = parseRouteSearchParams(
    searchParams,
    descriptionsQuerySchema,
    "Invalid target",
  );
  if (parsedQuery instanceof Response) {
    return badRequest("Invalid target");
  }

  const targetType = parsedQuery.targetType;
  const target = resolveDescriptionTarget(
    targetType as DescriptionTargetType,
    parsedQuery.targetId,
  );
  if (!target) {
    return badRequest("Invalid target");
  }

  try {
    const payload = await getDescriptionPayload(targetType, target.targetId);
    return jsonResponse(payload);
  } catch (error) {
    return handleRouteError("Failed to fetch description", error);
  }
}
export const GET = observedApiRoute(getRoute);

/**
 * Upsert description by target.
 * @body descriptionUpsertRequestSchema
 * @response descriptionUpsertResponseSchema
 * @response 400:openApiErrorSchema
 */
async function postRoute(request: Request) {
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

  const auth = await requireWriteAuth(request);
  if (auth instanceof Response) {
    return auth;
  }
  const { userId } = auth;

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

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.description.findFirst({
        where: target.where,
      });
      if (existing && existing.content === content) {
        return { id: existing.id, updated: false };
      }

      const description = existing
        ? await tx.description.update({
            where: { id: existing.id },
            data: {
              content,
              lastEditedAt: new Date(),
              lastEditedById: userId,
            },
          })
        : await tx.description.create({
            data: {
              content,
              lastEditedAt: new Date(),
              lastEditedById: userId,
              ...target.where,
            },
          });

      await tx.descriptionEdit.create({
        data: {
          descriptionId: description.id,
          editorId: userId,
          previousContent: existing?.content ?? null,
          nextContent: content,
        },
      });

      return { id: description.id, updated: true };
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
export const POST = observedApiRoute(postRoute);
