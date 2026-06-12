import {
  type DescriptionTargetType,
  resolveDescriptionTarget,
} from "@/features/descriptions/lib/description-targets";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { descriptionsQuerySchema } from "@/lib/api/schemas/request-schemas";

export async function getDescriptionRoute(request: Request) {
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
    const { getDescriptionPayload } = await import(
      "@/features/descriptions/server/descriptions-server"
    );
    const payload = await getDescriptionPayload(targetType, target.targetId);
    return jsonResponse(payload);
  } catch (error) {
    return handleRouteError("Failed to fetch description", error);
  }
}
