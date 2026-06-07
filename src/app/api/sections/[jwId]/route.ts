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
import { findSectionDetailByJwId } from "@/lib/course-section-queries";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Get section detail by JW ID.
 * @pathParams jwIdPathParamsSchema
 * @response sectionDetailSchema
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
      "Invalid section ID",
    );
    if (parsedParams instanceof Response) {
      return invalidParamResponse("section ID");
    }

    const { jwId } = parsedParams;
    const parsedJwId = parseInteger(jwId);

    if (parsedJwId === null) {
      return invalidParamResponse("section ID");
    }

    const section = await findSectionDetailByJwId(parsedJwId, "zh-cn");

    if (!section) {
      return notFound("Section not found");
    }

    return jsonResponse(section);
  } catch (error) {
    return handleRouteError("Failed to fetch section", error);
  }
}
export const GET = observedApiRoute(getRoute);
