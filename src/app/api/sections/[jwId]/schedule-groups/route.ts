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
import { getPrisma } from "@/lib/db/prisma";
import { observedApiRoute } from "@/lib/log/api-observability";

export const dynamic = "force-dynamic";

/**
 * Get schedule groups for one section.
 * @pathParams jwIdPathParamsSchema
 * @response 200:array
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

    const section = await getPrisma("zh-cn").section.findUnique({
      where: { jwId: parsedJwId },
      include: {
        scheduleGroups: {
          select: { schedules: true },
          orderBy: [{ isDefault: "desc" }, { no: "asc" }],
        },
      },
    });

    if (!section) {
      return notFound("Section not found");
    }

    return jsonResponse(section.scheduleGroups);
  } catch (error) {
    return handleRouteError("Failed to fetch schedule groups", error);
  }
}
export const GET = observedApiRoute(getRoute);
