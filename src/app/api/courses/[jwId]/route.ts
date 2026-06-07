import type { NextRequest } from "next/server";
import {
  handleRouteError,
  invalidParamResponse,
  jsonResponse,
  notFound,
  parseInteger,
  parseRouteParams,
} from "@/lib/api/helpers";
import { jwIdPathParamsSchema } from "@/lib/api/schemas/request-schemas";
import { findCourseDetailByJwId } from "@/lib/course-section-queries";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Get course detail by JW ID.
 * @pathParams jwIdPathParamsSchema
 * @response courseDetailSchema
 * @response 404:openApiErrorSchema
 */
async function getRoute(
  _request: NextRequest,
  context: { params: Promise<{ jwId: string }> },
) {
  try {
    const parsedParams = await parseRouteParams(
      context.params,
      jwIdPathParamsSchema,
      "Invalid course ID",
    );
    if (parsedParams instanceof Response) {
      return invalidParamResponse("course ID");
    }

    const parsedJwId = parseInteger(parsedParams.jwId);
    if (parsedJwId === null) {
      return invalidParamResponse("course ID");
    }

    const course = await findCourseDetailByJwId(parsedJwId, "zh-cn");

    if (!course) {
      return notFound("Course not found");
    }

    return jsonResponse(course);
  } catch (error) {
    return handleRouteError("Failed to fetch course", error);
  }
}
export const GET = observedApiRoute(getRoute);
