import type { NextRequest } from "next/server";
import {
  handleRouteError,
  invalidParamResponse,
  jsonResponse,
  notFound,
  parseInteger,
  parseRouteParams,
} from "@/lib/api/helpers";
import { resourceIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { getPrisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";
import { teacherDetailInclude } from "@/lib/query-helpers";

export const dynamic = "force-dynamic";

/**
 * Get teacher detail by numeric ID.
 * @pathParams resourceIdPathParamsSchema
 * @response teacherDetailSchema
 * @response 404:openApiErrorSchema
 */
async function getRoute(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const parsedParams = await parseRouteParams(
      context.params,
      resourceIdPathParamsSchema,
      "Invalid teacher ID",
    );
    if (parsedParams instanceof Response) {
      return invalidParamResponse("teacher ID");
    }

    const parsedId = parseInteger(parsedParams.id);
    if (parsedId === null) {
      return invalidParamResponse("teacher ID");
    }

    const teacher = await getPrisma("zh-cn").teacher.findUnique({
      where: { id: parsedId },
      include: teacherDetailInclude,
    });

    if (!teacher) {
      return notFound("Teacher not found");
    }

    return jsonResponse(teacher);
  } catch (error) {
    return handleRouteError("Failed to fetch teacher", error);
  }
}
export const GET = observedApiRoute(getRoute);
