import {
  type DescriptionTargetType,
  resolveDescriptionTargetReference,
} from "@/features/descriptions/server/description-targets";
import {
  badRequest,
  handleRouteError,
  jsonResponse,
  notFound,
  parseRouteSearchParams,
} from "@/lib/api/helpers";
import { descriptionsQuerySchema } from "@/lib/api/schemas/request-schemas";
import { resolveApiUserId } from "@/lib/auth/api-auth";
import { getViewerContext } from "@/lib/auth/viewer-context";

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

  const target = await resolveDescriptionTargetReference({
    courseJwId: parsedQuery.courseJwId,
    homeworkId: parsedQuery.homeworkId,
    rawTargetId: parsedQuery.targetId,
    sectionJwId: parsedQuery.sectionJwId,
    targetType: parsedQuery.targetType as DescriptionTargetType,
    teacherId: parsedQuery.teacherId,
    verifyExistence: true,
  });
  if (!target.ok && target.error === "target_not_found") {
    return notFound("Target not found");
  }
  if (!target.ok) {
    return badRequest("Invalid target");
  }

  try {
    const viewerUserId = await resolveApiUserId(request);
    const viewer = await getViewerContext({ userId: viewerUserId });
    const { getResolvedDescriptionPayload } = await import(
      "@/features/descriptions/server/descriptions-server"
    );
    const payload = await getResolvedDescriptionPayload(target.target, viewer);
    return jsonResponse(payload);
  } catch (error) {
    return handleRouteError("Failed to fetch description", error);
  }
}
